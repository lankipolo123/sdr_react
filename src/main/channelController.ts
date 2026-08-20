import { EventEmitter } from 'events'
import { PortScheduler } from './portScheduler'
import { dllSendFrame } from './dll/transit'
import { buildOutputSwitch, buildSignalControl } from './protocol/frame'
import { LEVEL_TO_POWER_CODE, MODE_WHITE_NOISE, type Level } from './protocol/constants'

function toHexString(frame: Buffer): string {
  return frame.toString('hex').toUpperCase().match(/../g)!.join(' ')
}

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
  lastFrameHex: string // the LOGICAL protocol bytes, e.g. "7E 7E 01 05 01 01 0A 0D" - NOT what's literally transmitted, see lastSentTokens
  lastSentTokens: string // what actually went into SendCommandToSDR, one CommandTokens-translated entry per byte, e.g. "XME XME X#A X#A X#A X#A X#J X#M"
}

function initialState(address: number): ChannelState {
  return {
    address,
    outputOn: false,
    level: 0,
    mode: MODE_WHITE_NOISE,
    lastLevel: 1,
    busy: false,
    lastCommand: '—',
    lastCommandUnconfirmed: false,
    lastFrameHex: '—',
    lastSentTokens: '—'
  }
}

export class ChannelController extends EventEmitter {
  readonly address: number
  private state: ChannelState

  constructor(
    address: number,
    private scheduler: PortScheduler
  ) {
    super()
    this.address = address
    this.state = initialState(address)
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
    // lastFrameHex is the LOGICAL protocol bytes - known immediately,
    // but not what's literally transmitted (CommandTokens translates
    // each byte before SendCommandToSDR ever sees it - see
    // dllSendFrame's own docs). lastSentTokens (the real translated
    // values) is only known after the DLL call actually runs below.
    this.update({ busy: true, lastCommand: label, lastFrameHex: toHexString(frame) })
    this.scheduler.acquire(this, () => {
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
          lastSentTokens: sentTokens.length > 0 ? sentTokens.join(' ') : this.state.lastSentTokens,
          ...(error !== null ? { lastCommand: `${label} - DLL error: ${error}` } : {})
        })
      }, SEND_SETTLE_MS)
    })
  }

  dispose(): void {
    this.scheduler.cancel(this)
    this.removeAllListeners()
  }
}
