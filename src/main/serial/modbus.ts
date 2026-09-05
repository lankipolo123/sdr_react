/**
 * Modbus RTU framing for the amplifier temperature/humidity sensor - a
 * completely separate, raw serial connection from the RS-422/
 * Transit.dll bus the channel cards use (see ../dll/transit.ts). Pure
 * protocol logic, no I/O, so it can be unit-tested without a real port.
 *
 * Confirmed against a real XY-MD02 temp/humidity module in the C
 * rewrite (digital-noise-configuration-multi's PLAN_temp_sensor.md,
 * later ported to sdr_app/services/modbus.py): slave address 1,
 * function 0x04 (Read Input Registers), starting register 1, count 2,
 * both values raw/10.
 */

export function crc16(data: Buffer): number {
  let crc = 0xffff
  for (const byte of data) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
    }
  }
  return crc
}

export function buildReadInputRegisters(slaveAddr: number, startRegister: number, count: number): Buffer {
  const body = Buffer.from([
    slaveAddr & 0xff,
    0x04,
    (startRegister >> 8) & 0xff,
    startRegister & 0xff,
    (count >> 8) & 0xff,
    count & 0xff
  ])
  const crc = crc16(body)
  return Buffer.concat([body, Buffer.from([crc & 0xff, (crc >> 8) & 0xff])])
}

export class ModbusError extends Error {}

/** Raises ModbusError for anything short of a fully valid, CRC-clean
 * response - including "not enough bytes yet", a normal, non-fatal
 * outcome when the sensor just hasn't answered this cycle. */
export function parseReadInputRegistersResponse(data: Buffer, slaveAddr: number, count: number): number[] {
  const expectedLen = 3 + count * 2 + 2 // addr + func + byte_count + data + crc16
  if (data.length < expectedLen) {
    throw new ModbusError(`incomplete response (${data.length}/${expectedLen} bytes)`)
  }

  const frame = data.subarray(0, expectedLen)

  if (frame[0] !== slaveAddr) {
    throw new ModbusError(`unexpected slave address ${frame[0]}`)
  }
  if (frame[1] === (0x04 | 0x80)) {
    throw new ModbusError(`device returned exception code ${frame[2]}`)
  }
  if (frame[1] !== 0x04) {
    throw new ModbusError(`unexpected function code ${frame[1]}`)
  }
  if (frame[2] !== count * 2) {
    throw new ModbusError(`unexpected byte count ${frame[2]}`)
  }

  const receivedCrc = frame[frame.length - 2] | (frame[frame.length - 1] << 8)
  const computedCrc = crc16(frame.subarray(0, -2))
  if (receivedCrc !== computedCrc) {
    throw new ModbusError('CRC mismatch')
  }

  const registers: number[] = []
  for (let i = 0; i < count; i++) {
    registers.push((frame[3 + i * 2] << 8) | frame[3 + i * 2 + 1])
  }
  return registers
}
