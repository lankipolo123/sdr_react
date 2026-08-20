import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { LEVEL_LABELS, MODE_NAMES, MODE_WHITE_NOISE, type Level } from './protocol/constants'
import type { ChannelState } from './channelController'

// Direct port of the reference app's utils/channel_store.py: a
// channels.ini "database" (INI sections, one per channel) that
// remembers each channel's last mode/level/output-on state across app
// restarts. Restores UI state only on load - never sends anything to
// the DLL by itself, since the hardware isn't even connected yet at
// startup.

export interface SavedChannelState {
  mode?: number
  lastLevel?: Level
  outputOn?: boolean
}

const MODE_NAME_TO_CODE = new Map<string, number>(
  Object.entries(MODE_NAMES).map(([code, name]) => [name, Number(code)])
)
// Reference app excludes level 0 ("Off") from the name<->level map -
// "power" in the file always names a real resume-to level (Low/Medium/
// High), never "Off" (that's carried separately via `output`).
const LEVEL_NAME_TO_LEVEL = new Map<string, Level>(
  (Object.entries(LEVEL_LABELS) as [string, string][])
    .filter(([level]) => Number(level) > 0)
    .map(([level, name]) => [name, Number(level) as Level])
)

export function loadChannelStates(path: string): Map<number, SavedChannelState> {
  const result = new Map<number, SavedChannelState>()
  if (!existsSync(path)) return result

  let text: string
  try {
    text = readFileSync(path, 'utf-8')
  } catch {
    return result
  }

  let currentAddress: number | null = null
  let currentEntry: SavedChannelState = {}
  const flush = (): void => {
    if (currentAddress !== null && Object.keys(currentEntry).length > 0) {
      result.set(currentAddress, currentEntry)
    }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue

    const sectionMatch = /^\[(.+)\]$/.exec(line)
    if (sectionMatch !== null) {
      flush()
      currentAddress = null
      currentEntry = {}
      const name = sectionMatch[1].toUpperCase()
      if (name.startsWith('CH')) {
        const address = Number(name.slice(2))
        if (Number.isInteger(address) && address > 0) currentAddress = address
      }
      continue
    }

    if (currentAddress === null) continue
    const kvMatch = /^([^=]+)=(.*)$/.exec(line)
    if (kvMatch === null) continue
    const key = kvMatch[1].trim().toLowerCase()
    const value = kvMatch[2].trim()

    if (key === 'mode' && MODE_NAME_TO_CODE.has(value)) {
      currentEntry.mode = MODE_NAME_TO_CODE.get(value)
    } else if (key === 'power' && LEVEL_NAME_TO_LEVEL.has(value)) {
      currentEntry.lastLevel = LEVEL_NAME_TO_LEVEL.get(value)
    } else if (key === 'output' && (value === 'on' || value === 'off')) {
      currentEntry.outputOn = value === 'on'
    }
  }
  flush()

  return result
}

export function saveChannelStates(states: ChannelState[], path: string): void {
  const lines: string[] = []
  for (const state of [...states].sort((a, b) => a.address - b.address)) {
    lines.push(`[CH${String(state.address).padStart(2, '0')}]`)
    lines.push(`mode = ${MODE_NAMES[state.mode] ?? MODE_NAMES[MODE_WHITE_NOISE]}`)
    lines.push(`power = ${LEVEL_LABELS[state.lastLevel]}`)
    lines.push(`output = ${state.outputOn ? 'on' : 'off'}`)
    lines.push('')
  }

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, lines.join('\n'), 'utf-8')
}
