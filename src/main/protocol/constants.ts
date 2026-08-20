// Wire protocol constants, confirmed against real hardware and the
// vendor DLL's own disassembly (see react_shadcn_rewrite_guide.md /
// protocol_and_dll_reference.md in the handoff package this was built
// from). Frame: HEAD(2) TYPE(1) ADDR(1) LEN(1) PAYLOAD(LEN) STOP(2).

export const HEAD = [126, 126] as const
export const STOP = [10, 13] as const

export const BROADCAST_ADDR = 255

export const TYPE_OUTPUT_SWITCH = 1
export const TYPE_SIGNAL_CONTROL = 2
export const TYPE_STATUS_QUERY = 255
export const TYPE_ADDR_QUERY = 191
export const TYPE_ADDR_SET = 177

export const OUTPUT_OFF = 0
export const OUTPUT_ON = 1

export const MODE_WHITE_NOISE = 0
export const MODE_LINEAR_SWEEP = 1
export const MODE_COMB_SPECTRUM = 2
export const MODE_SINGLE = 3

export const MODE_NAMES: Record<number, string> = {
  [MODE_WHITE_NOISE]: 'Pseudo Random Noise',
  [MODE_LINEAR_SWEEP]: 'Linear Sweep',
  [MODE_COMB_SPECTRUM]: 'Multi-tone',
  [MODE_SINGLE]: 'Continuous Wave (CW)'
}

export const BANDWIDTH_CODES: Record<number, number> = {
  10: 0,
  20: 1,
  50: 2,
  100: 3,
  150: 4,
  200: 5,
  250: 6,
  300: 7
}

export const RESP_FAILED = 1
export const RESP_SUCCESS = 255

// "Blind send" defaults (confirmed from the reference app's own
// compiled binary - it has no Frequency/Bandwidth UI at all, these are
// plain literals baked into every Signal Control send). Only mode and
// power/level are ever real user selections - see section 5 of the
// rewrite guide.
export const BLIND_DEFAULT_FREQUENCY_MHZ = 2450
export const BLIND_DEFAULT_BANDWIDTH_MHZ = 100

export type Level = 0 | 1 | 2 | 3

// UI level -> power_code. Level 0 (Off) has no power_code - it's always
// sent as an explicit Output Switch OFF, never a Signal Control frame.
export const LEVEL_TO_POWER_CODE: Record<Level, number | null> = {
  0: null,
  1: 2,
  2: 1,
  3: 0
}

export const LEVEL_LABELS: Record<Level, string> = {
  0: 'Off',
  1: 'Low',
  2: 'Medium',
  3: 'High'
}

export const MAX_CHANNELS = 16
