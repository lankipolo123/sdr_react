import {
  HEAD,
  STOP,
  BROADCAST_ADDR,
  TYPE_OUTPUT_SWITCH,
  TYPE_SIGNAL_CONTROL,
  OUTPUT_ON,
  OUTPUT_OFF,
  BANDWIDTH_CODES,
  BLIND_DEFAULT_FREQUENCY_MHZ,
  BLIND_DEFAULT_BANDWIDTH_MHZ
} from './constants'

export class ProtocolError extends Error {}

function frame(typeByte: number, addr: number, payload: number[]): Buffer {
  if (addr < 0 || addr > 0xff) {
    throw new ProtocolError(`Address out of range: ${addr}`)
  }
  if (payload.length > 0xff) {
    throw new ProtocolError('Payload too long for 1-byte LEN field')
  }
  return Buffer.from([...HEAD, typeByte, addr, payload.length, ...payload, ...STOP])
}

export function buildOutputSwitch(addr: number, on: boolean): Buffer {
  return frame(TYPE_OUTPUT_SWITCH, addr, [on ? OUTPUT_ON : OUTPUT_OFF])
}

/**
 * Signal Control payload, per the confirmed frame format: mode(1) +
 * frequency_mhz(2, big-endian) + bandwidth_code(1) + power_code(1).
 *
 * frequencyMhz/bandwidthMhz default to the reference app's own blind
 * constants (2450MHz / 100MHz) - the current UI never exposes these,
 * matching the reference app exactly (see the rewrite guide's "blind
 * send architecture" section). Pass real values explicitly only if a
 * future UI adds Frequency/Bandwidth controls on purpose.
 */
export function buildSignalControl(
  addr: number,
  mode: number,
  powerCode: number,
  frequencyMhz: number = BLIND_DEFAULT_FREQUENCY_MHZ,
  bandwidthMhz: number = BLIND_DEFAULT_BANDWIDTH_MHZ
): Buffer {
  const bandwidthCode = BANDWIDTH_CODES[bandwidthMhz]
  if (bandwidthCode === undefined) {
    throw new ProtocolError(`Unsupported bandwidth: ${bandwidthMhz} MHz`)
  }
  const freqHi = (frequencyMhz >> 8) & 0xff
  const freqLo = frequencyMhz & 0xff
  return frame(TYPE_SIGNAL_CONTROL, addr, [mode, freqHi, freqLo, bandwidthCode, powerCode])
}

export function buildStatusQuery(addr: number = 0): Buffer {
  return frame(255, addr, [])
}

export function buildAddrQuery(): Buffer {
  return frame(191, BROADCAST_ADDR, [])
}

export function buildAddrSet(newAddr: number): Buffer {
  if (newAddr < 0 || newAddr > 199) {
    throw new ProtocolError(`Address out of range: ${newAddr}`)
  }
  return frame(177, BROADCAST_ADDR, [newAddr])
}
