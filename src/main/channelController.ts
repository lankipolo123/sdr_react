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
    lastCommandUnconfirmed: false
  }
}

export class ChannelController extends EventEmitter {
  readonly address: number
  private state: ChannelState

  constructor(
    address: number,
    private scheduler: PortScheduler,
    saved?: SavedChannelState
  ) {
    super()
    this.address = address
    this.state = initialState(address, saved)
  }

  getState(): ChannelState {
    return { ...this.state }
  }

  private update(patch: Partial<ChannelState>): void {
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
      }, SEND_SETTLE_MS)
    })
  }

  dispose(): void {
    this.scheduler.cancel(this)
    this.removeAllListeners()
  }
}
