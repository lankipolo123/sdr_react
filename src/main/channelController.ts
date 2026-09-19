import { EventEmitter } from 'events'
import { PortScheduler } from './portScheduler'
import { dllSendFrame } from './dll/transit'
import { buildOutputSwitch, buildSignalControl } from './protocol/frame'
import { LEVEL_TO_POWER_CODE, MODE_WHITE_NOISE, type Level } from './protocol/constants'
import type { SavedChannelState } from './channelStore'

// Hardware-tuned final values from the reference app (see rewrite
// guide section 5): RS422 here is a shared bus with no tri-state
// control, so silence on a send is genuinely ambiguous - not a clean
// fail signal. Design choice: send once, no retry, then apply
// optimistically and mark it unconfirmed rather than block/revert.
const SEND_SETTLE_MS = 300

export interface ChannelState {
  address: number // 1-16, matches the wire ADDR byte directly (confirmed via the vendor doc's own "Channel 1" -> ADDR=1 example)
  outputOn: boolean
  level: Level
  mode: number
  lastLevel: Level // resume-to level on toggle-on; never 0
  busy: boolean
  lastCommand: string
  lastCommandUnconfirmed: boolean
  // Cumulative ON-time, in seconds - an odometer, not an app-uptime
  // counter (see ChannelController's uptimeBaseSeconds/onSince comment).
  // Always freshly computed as of "now" (see getState()), so it reads
  // correctly even without a new IPC event since the last ON/OFF edge -
  // the renderer ticks it forward locally between updates.
  uptimeSeconds: number
  // Deliberately NOT exposing the frame's raw/logical protocol bytes
  // anywhere in this state object - those must never be visible. The
  // DLL-translated values (what CommandTokens/SendCommandToSDR actually
  // transmit) ARE safe/intended to be visible - that substitution is
  // the whole point of routing through the DLL instead of sending raw
  // bytes - but they're emitted separately via the 'log' event, not
  // included in this per-channel state object.
}

export interface LogEntry {
  address: number
  label: string
  sentTokens: string[]
  timestamp: number
}

// saved comes from channels.ini (see channelStore.ts) - restores what
// the app last knew about this channel across a restart. It only
// seeds the in-memory/UI state; nothing here sends to the DLL, since
// the hardware isn't connected yet at construction time.
function initialState(address: number, saved?: SavedChannelState): ChannelState {
  const lastLevel = saved?.lastLevel ?? 1
  const outputOn = saved?.outputOn ?? false
  return {
    address,
    outputOn,
    level: outputOn ? lastLevel : 0,
    mode: saved?.mode ?? MODE_WHITE_NOISE,
    lastLevel,
    busy: false,
    lastCommand: '—',
    lastCommandUnconfirmed: false,
    uptimeSeconds: saved?.uptimeSeconds ?? 0
  }
}

export class ChannelController extends EventEmitter {
  readonly address: number
  private state: ChannelState
  // Cumulative ON-time tracking (see ChannelState.uptimeSeconds) - an
  // odometer, not an app-uptime counter: each channel tracks its OWN
  // time actually transmitting, not how long the app process has been
  // open. uptimeBaseSeconds is everything accumulated BEFORE the
  // channel's current ON period (or the whole total, while it's off);
  // onSince is when the current ON period started (epoch ms,
  // meaningful only while outputOn) - direct port of the C rewrite's
  // g_channel_uptime_base_seconds/g_channel_on_since_ms, adapted to
  // this codebase's event-driven state updates instead of a WM_TIMER
  // poll: the edge is detected the moment outputOn actually changes
  // (in update()) rather than by comparing against last tick's value.
  private uptimeBaseSeconds: number
  private onSince: number | null

  constructor(
    address: number,
    private scheduler: PortScheduler,
    saved?: SavedChannelState
  ) {
    super()
    this.address = address
    this.state = initialState(address, saved)
    this.uptimeBaseSeconds = saved?.uptimeSeconds ?? 0
    // A channel restored as already ON starts a fresh ON period timed
    // from app launch - same behavior as the C rewrite, whose first
    // WM_TIMER tick after startup sees output_on=true against a
    // zero-initialized "last tick" value and treats it as an OFF->ON
    // edge. The app has no way to know how long it was ON while the
    // app itself wasn't running, so that gap isn't credited - only
    // time the app actually tracked ever counts.
    this.onSince = this.state.outputOn ? Date.now() : null
  }

  private currentUptimeSeconds(): number {
    const live = this.onSince !== null ? (Date.now() - this.onSince) / 1000 : 0
    return this.uptimeBaseSeconds + live
  }

  getState(): ChannelState {
    return { ...this.state, uptimeSeconds: this.currentUptimeSeconds() }
  }

  private update(patch: Partial<ChannelState>): void {
    if (patch.outputOn !== undefined && patch.outputOn !== this.state.outputOn) {
      if (patch.outputOn) {
        this.onSince = Date.now()
      } else if (this.onSince !== null) {
        this.uptimeBaseSeconds += (Date.now() - this.onSince) / 1000
        this.onSince = null
      }
    }
    this.state = { ...this.state, ...patch }
    this.emit('changed', this.getState())
  }

  turnOutputOn(): void {
    this.send(buildOutputSwitch(this.address, true), 'Output ON', { outputOn: true, level: this.state.lastLevel })
  }

  turnOutputOff(): void {
    this.send(buildOutputSwitch(this.address, false), 'Output OFF', { outputOn: false, level: 0 })
  }

  setLevel(level: Level): void {
    const powerCode = LEVEL_TO_POWER_CODE[level]
    if (powerCode === null) {
      this.turnOutputOff()
      return
    }
    const patch: Partial<ChannelState> = { level, lastLevel: level }
    if (!this.state.outputOn) {
      // Was off - needs an explicit Output Switch ON first (Signal
      // Control alone doesn't re-enable RF output on this hardware,
      // confirmed in the reference app). Queued as two separate sends
      // through the same scheduler, in order.
      this.send(buildOutputSwitch(this.address, true), 'Output ON (resume)', { outputOn: true })
    }
    this.send(
      buildSignalControl(this.address, this.state.mode, powerCode),
      `Level -> ${level}`,
      { ...patch, outputOn: true }
    )
  }

  setMode(mode: number): void {
    const powerCode = LEVEL_TO_POWER_CODE[this.state.level] ?? LEVEL_TO_POWER_CODE[this.state.lastLevel]!
    this.send(buildSignalControl(this.address, mode, powerCode), `Mode -> ${mode}`, { mode })
  }

  private send(frame: Buffer, label: string, applyOnSettle: Partial<ChannelState>): void {
    this.update({ busy: true, lastCommand: label })
    this.scheduler.acquire(this, () => {
      // frame itself (the raw/logical protocol bytes) stays confined to
      // this function and is never emitted anywhere - only
      // dllSendFrame's sentTokens (the safe, DLL-translated values) get
      // published, via the 'log' event below, never via `this.state`.
      const { error, sentTokens } = dllSendFrame(frame)
      // Single attempt, no retry (final tuned behavior - see module
      // docstring). Settle delay paces sends and gives the "applied
      // optimistically" label time to mean something, rather than
      // flipping state the instant the DLL call returns.
      setTimeout(() => {
        this.scheduler.release(this)
        this.update({
          ...applyOnSettle,
          busy: false,
          lastCommandUnconfirmed: true,
          ...(error !== null ? { lastCommand: `${label} - DLL error: ${error}` } : {})
        })
        this.emit('log', {
          address: this.address,
          label: error !== null ? `${label} - DLL error: ${error}` : label,
          sentTokens,
          timestamp: Date.now()
        } satisfies LogEntry)
        // A DLL call throwing (as opposed to succeeding with a "rejected"
        // response - there isn't one here, sends are fire-and-forget) means
        // the hardware bridge itself is gone, most likely the USB adapter
        // was unplugged. ConnectionContext's `status` only ever gets set by
        // explicit connect()/disconnect() calls, so without this it would
        // sit on "connected" forever while every command kept failing -
        // requireConnected() would keep waving commands through into a dead
        // DLL instead of re-prompting the user to reconnect.
        if (error !== null) {
          this.emit('port-lost', error)
        }
      }, SEND_SETTLE_MS)
    })
  }

  dispose(): void {
    this.scheduler.cancel(this)
    this.removeAllListeners()
  }
}
