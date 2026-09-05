import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { buildReadInputRegisters, parseReadInputRegistersResponse, ModbusError } from './modbus'

// XY-MD02 temperature/humidity sensor over Modbus RTU, on its own USB-
// RS485 adapter - a real, separate raw serial connection, completely
// independent of the RS-422/Transit.dll bus the channel cards use (see
// ../dll/transit.ts). Confirmed against real hardware in the C rewrite
// (digital-noise-configuration-multi) and ported unchanged to
// sdr_app/hooks/use_sensor.py: slave 1, function 0x04, register 1,
// count 2, both values raw/10.
const SENSOR_SLAVE_ADDR = 1
const SENSOR_START_REGISTER = 1
const SENSOR_REGISTER_COUNT = 2
const SENSOR_BAUD = 9600
const SENSOR_POLL_INTERVAL_MS = 3000
const SENSOR_RESPONSE_TIMEOUT_MS = 500
// addr + func + byte_count + 2 registers * 2 bytes + crc16
const EXPECTED_RESPONSE_LEN = 3 + SENSOR_REGISTER_COUNT * 2 + 2

export interface SensorState {
  connected: boolean
  online: boolean
  hasReading: boolean
  temperatureC: number
  humidityPct: number
  attemptCount: number
  lastRxLen: number
}

function initialState(): SensorState {
  return {
    connected: false,
    online: false,
    hasReading: false,
    temperatureC: 0,
    humidityPct: 0,
    attemptCount: 0,
    lastRxLen: 0
  }
}

/**
 * Unlike the channel cards' blind sends (fire once, apply
 * optimistically), a register read genuinely needs the reply - there's
 * no value to show without it. Node's serial I/O is natively async/
 * event-driven, so unlike the C rewrite (which hand-rolls a non-
 * blocking state machine because its one thread also owns the message
 * loop) or sdr_app (a bounded blocking read on its own throwaway
 * thread), this just drives off SerialPort's own 'data'/'error'/'close'
 * events plus a couple of timers - no manual polling loop needed.
 */
export class SensorController extends EventEmitter {
  private port: SerialPort | null = null
  private rxBuf: Buffer = Buffer.alloc(0)
  private pollTimer: NodeJS.Timeout | null = null
  private responseTimer: NodeJS.Timeout | null = null
  private state: SensorState = initialState()

  static async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => p.path)
  }

  isConnected(): boolean {
    return this.port !== null
  }

  getState(): SensorState {
    return { ...this.state }
  }

  connect(path: string): Promise<boolean> {
    if (this.isConnected()) return Promise.resolve(true)

    return new Promise((resolve) => {
      const port = new SerialPort({
        path,
        baudRate: SENSOR_BAUD,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      })

      port.open((openErr) => {
        if (openErr) {
          resolve(false)
          return
        }
        // Same fix as the C rewrite's serial_open() / sdr_app's
        // use_sensor.py: explicitly set RTS/DTR rather than leaving them
        // at an inherited/undefined state. An RS-485 USB adapter often
        // uses RTS as its transmit/receive direction switch - an
        // inherited "stuck asserted" RTS can latch it in transmit-only
        // mode, so requests go out fine but it never listens for a reply.
        port.set({ rts: false, dtr: true }, () => {
          this.port = port
          this.rxBuf = Buffer.alloc(0)
          this.state = initialState()
          this.state.connected = true

          port.on('data', (chunk: Buffer) => this.onData(port, chunk))
          port.on('error', (err) => this.portLost(port, err.message))
          port.on('close', () => {
            // A close this controller didn't itself initiate (disconnect()
            // nulls this.port before closing) means the OS dropped the
            // port out from under it - most likely the adapter was
            // unplugged.
            if (this.port === port) this.portLost(port, 'port closed unexpectedly')
          })

          this.notify()
          this.schedulePoll(0)
          resolve(true)
        })
      })
    })
  }

  disconnect(): void {
    this.clearTimers()
    const port = this.port
    this.port = null
    if (port) {
      port.removeAllListeners()
      port.close(() => {})
    }
    // Reset to unknown rather than leaving a stale reading on screen -
    // same "never show a value we can't currently vouch for" rule the
    // rest of this app family follows.
    this.state = initialState()
    this.notify()
  }

  private notify(): void {
    this.emit('changed', this.getState())
  }

  private clearTimers(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.responseTimer) {
      clearTimeout(this.responseTimer)
      this.responseTimer = null
    }
  }

  private schedulePoll(delayMs: number): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => this.sendRequest(), delayMs)
  }

  private sendRequest(): void {
    const port = this.port
    if (!port) return

    const request = buildReadInputRegisters(SENSOR_SLAVE_ADDR, SENSOR_START_REGISTER, SENSOR_REGISTER_COUNT)
    this.rxBuf = Buffer.alloc(0)
    this.state.attemptCount++

    port.write(request, (writeErr) => {
      if (this.port !== port) return // stale callback from a since-closed port
      if (writeErr) {
        this.portLost(port, writeErr.message)
        return
      }
      this.responseTimer = setTimeout(() => this.finishCycle(false), SENSOR_RESPONSE_TIMEOUT_MS)
    })
  }

  private onData(port: SerialPort, chunk: Buffer): void {
    if (this.port !== port) return
    this.rxBuf = Buffer.concat([this.rxBuf, chunk])
    this.state.lastRxLen = this.rxBuf.length

    try {
      const registers = parseReadInputRegistersResponse(this.rxBuf, SENSOR_SLAVE_ADDR, SENSOR_REGISTER_COUNT)
      this.state.temperatureC = registers[0] / 10
      this.state.humidityPct = registers[1] / 10
      this.state.hasReading = true
      this.finishCycle(true)
    } catch (e) {
      if (e instanceof ModbusError && this.rxBuf.length >= EXPECTED_RESPONSE_LEN) {
        // Enough bytes came back but they didn't parse (bad CRC, an
        // exception frame, wrong function/address) - a real "not
        // responding" outcome this cycle, not "keep waiting for more
        // bytes".
        this.finishCycle(false)
      }
      // else: still short of EXPECTED_RESPONSE_LEN - keep waiting for
      // either more data or the response timeout.
    }
  }

  private finishCycle(gotValidReply: boolean): void {
    if (this.responseTimer) {
      clearTimeout(this.responseTimer)
      this.responseTimer = null
    }
    this.state.online = gotValidReply
    this.notify()
    this.schedulePoll(SENSOR_POLL_INTERVAL_MS)
  }

  private portLost(port: SerialPort, error: string): void {
    // A hard write/read/port error (as opposed to "no bytes back this
    // cycle", which is a normal Modbus timeout, not a port failure)
    // means the port itself is gone - most likely the USB adapter was
    // unplugged. Disconnect immediately so isConnected()/the UI reflect
    // that, rather than staying "connected" against a dead port forever -
    // the same fix just shipped for the C rewrite's RS-422/sensor ports
    // and this app's own DLL bridge (see channelController.ts's
    // 'port-lost' event).
    if (this.port !== port) return
    this.disconnect()
    this.emit('portLost', error)
  }
}
