import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

// Small JSON settings file, same directory convention as channelStore.ts/
// logStore.ts (under Electron's userData dir). Currently just remembers
// which port the amplifier temperature sensor was last connected to -
// never auto-connects on startup, just pre-selects it in the port list.

export interface Settings {
  sensorPort: string | null
}

function defaults(): Settings {
  return { sensorPort: null }
}

export function loadSettings(path: string): Settings {
  if (!existsSync(path)) return defaults()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return { ...defaults(), ...parsed }
  } catch {
    return defaults()
  }
}

export function saveSettings(settings: Settings, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}
