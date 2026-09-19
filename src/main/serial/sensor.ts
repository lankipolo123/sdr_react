import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { buildReadInputRegisters, parseReadInputRegistersResponse, ModbusError } from './modbus'

// XY-MD02 temperature/humidity sensors over Modbus RTU, on their own USB-
// RS485 adapter - a real, separate raw serial connection, completely
// independent of the RS-422/Transit.dll bus the channel cards use (see
// ../dll/transit.ts). Confirmed against real hardware in the C rewrite
// (digital-noise-configuration-multi/src/sensor.c): function 0x04,
// register 1, count 2, both values raw/10.
//
// NOT one sensor per RF channel - there are SENSOR_MAX_UNITS physical
// sensor units total, scanning the rack area collectively, independent
// of the 16 RF channels. Each has its own configured Modbus slave
// address (defaults to unit index + 1, i.e. 1-4; real wiring may not be
// sequential). Round-robins continuously - one unit in flight at a
// time, SENSOR_PER_UNIT_GAP_MS between finishing one and starting the
// next - rather than waiting a full poll interval per unit, so a full
// 4-unit round trip stays fast enough to notice an overtemp promptly.
export const SENSOR_MAX_UNITS = 4
const SENSOR_START_REGISTER = 1
const SENSOR_REGISTER_COUNT = 2
const SENSOR_BAUD = 9600
const SENSOR_PER_UNIT_GAP_MS = 150
const SENSOR_RESPONSE_TIMEOUT_MS = 500
// addr + func + byte_count + 2 registers * 2 bytes + crc16
const EXPECTED_RESPONSE_LEN = 3 + SENSOR_REGISTER_COUNT * 2 + 2

export interface SensorUnitState {
  address: number // configured Modbus slave address for this unit (1-based)
  online: boolean
  hasReading: boolean
  temperatureC: number
  humidityPct: number
  attemptCount: number
  lastRxLen: number
}

export interface SensorState {
  connected: boolean
  units: SensorUnitState[] // length SENSOR_MAX_UNITS, index 0..3 = BAY 1..4
}

function initialUnitState(address: number): SensorUnitState {
  return {
    address,
    online: false,
    hasReading: false,
    temperatureC: 0,
    humidityPct: 0,
    attemptCount: 0,
    lastRxLen: 0
  }
}

function initialState(): SensorState {
  return {
    connected: false,
    units: Array.from({ length: SENSOR_MAX_UNITS }, (_, i) => initialUnitState(i + 1))
  }
}

/**
 * Unlike the channel cards' blind sends (fire once, apply
 * optimistically), a register read genuinely needs the reply - there's
 * no value to show without it. Node's serial I/O is natively async/
 * event-driven, so unlike the C rewrite (which hand-rolls a non-
 * blocking state machine because its one thread also owns the message
 * loop), this just drives off SerialPort's own 'data'/'error'/'close'
 * events plus a couple of timers - no manual polling loop needed.
 */
export class SensorController extends EventEmitter {
  private port: SerialPort | null = null
  private rxBuf: Buffer = Buffer.alloc(0)
  private pollTimer: NodeJS.Timeout | null = null
  private responseTimer: NodeJS.Timeout | null = null
  private currentUnit = 0
  private state: SensorState = initialState()

  static async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => p.path)
  }

  isConnected(): boolean {
    return this.port !== null
  }

  getState(): SensorState {
    return { ...this.state, units: this.state.units.map((u) => ({ ...u })) }
  }

  /** Rack-wide summary: mean temperature across every unit that
   * currently has a real reading - units still waiting on their first
   * reply don't skew it. Returns null if no unit has a reading yet,
   * same "don't show a value we can't vouch for" rule as everything
   * else here. */
  getAverageTemperature(): number | null {
    const readings = this.state.units.filter((u) => u.hasReading)
    if (readings.length === 0) return null
    return readings.reduce((sum, u) => sum + u.temperatureC, 0) / readings.length
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
        // Same fix as the C rewrite's serial_open(): explicitly set
        // RTS/DTR rather than leaving them at an inherited/undefined
        // state. An RS-485 USB adapter often uses RTS as its transmit/
        // receive direction switch - an inherited "stuck asserted" RTS
        // can latch it in transmit-only mode, so requests go out fine
        // but it never listens for a reply.
        port.set({ rts: false, dtr: true }, () => {
          this.port = port
          this.rxBuf = Buffer.alloc(0)
          this.currentUnit = 0
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
    this.currentUnit = 0
    if (port) {
      port.removeAllListeners()
      port.close(() => {})
    }
    // Reset to unknown rather than leaving stale readings on screen -
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

    const unit = this.state.units[this.currentUnit]
    const request = buildReadInputRegisters(unit.address, SENSOR_START_REGISTER, SENSOR_REGISTER_COUNT)
    this.rxBuf = Buffer.alloc(0)
    unit.attemptCount++

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
    const unit = this.state.units[this.currentUnit]
    unit.lastRxLen = this.rxBuf.length

    try {
      const registers = parseReadInputRegistersResponse(this.rxBuf, unit.address, SENSOR_REGISTER_COUNT)
      unit.temperatureC = registers[0] / 10
      unit.humidityPct = registers[1] / 10
      unit.hasReading = true
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
    this.state.units[this.currentUnit].online = gotValidReply
    this.currentUnit = (this.currentUnit + 1) % SENSOR_MAX_UNITS
    this.notify()
    this.schedulePoll(SENSOR_PER_UNIT_GAP_MS)
  }

  private portLost(port: SerialPort, error: string): void {
    // A hard write/read/port error (as opposed to "no bytes back this
    // cycle", which is a normal Modbus timeout, not a port failure)
    // means the port itself is gone - most likely the USB adapter was
    // unplugged. Disconnect immediately so isConnected()/the UI reflect
    // that, rather than staying "connected" against a dead port forever.
    if (this.port !== port) return
    this.disconnect()
    this.emit('portLost', error)
  }
}
