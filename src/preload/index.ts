import { contextBridge, ipcRenderer } from 'electron'
import type { ChannelState, LogEntry } from '../main/channelController'
import type { LogPage } from '../main/logStore'
import { MAX_CHANNELS, type Level } from '../main/protocol/constants'
import type { DllCallResult } from '../main/dll/transit'
import type { SensorState } from '../main/serial/sensor'
import type { KillSwitchState } from '../main/safety'

// Every channel card mounts its own onChanged listener on the shared
// 'channel:changed' IPC event (16 of them, one per channel) - legitimate
// fan-out, not a leak, but it trips Node's default 10-listener cap and
// logs a false-positive MaxListenersExceededWarning. Give it enough
// headroom for all channels plus normal one-off listeners.
ipcRenderer.setMaxListeners(MAX_CHANNELS + 10)

// Renderer never touches the DLL or serial layer directly - only the
// main process does. This is the one, small, typed surface the
// renderer is allowed to call, mirroring the reference app's
// ChannelController / state.changed signal pattern over IPC instead of
// Qt signals.
const api = {
  app: {
    quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
    // "Turn Off and Close" choice on the close-confirmation dialog -
    // commands every channel off for real (paced through the shared
    // PortScheduler - can take a few seconds for a full rack) before
    // actually quitting. See main/index.ts's own comment.
    turnOffAllAndQuit: (): Promise<void> => ipcRenderer.invoke('app:turnOffAllAndQuit'),
    // One-shot: reports the real, unclipped content height (measured
    // from the root layout element's scrollHeight) once shortly after
    // the Commands page's first paint, so the window can size itself
    // to fit exactly instead of shipping a guessed constant that goes
    // stale every time the layout changes height.
    reportContentHeight: (height: number): void => ipcRenderer.send('app:contentHeight', height)
  },
  // Load Config / Save Config (Sidebar.tsx) - a config file is the same
  // channels.ini format channelStore.ts already uses for the automatic
  // per-restart save, just written to/read from a user-picked path via
  // a real file dialog instead of the fixed userData one.
  config: {
    save: (): Promise<{ saved: boolean; path: string | null }> => ipcRenderer.invoke('config:save'),
    load: (): Promise<{ applied: number; skipped: number } | null> => ipcRenderer.invoke('config:load')
  },
  dll: {
    autoConnect: (): Promise<DllCallResult> => ipcRenderer.invoke('dll:autoConnect'),
    checkConnection: (): Promise<DllCallResult> => ipcRenderer.invoke('dll:checkConnection'),
    disconnect: (): Promise<DllCallResult> => ipcRenderer.invoke('dll:disconnect'),
    loadError: (): Promise<string | null> => ipcRenderer.invoke('dll:loadError'),
    // Fires whenever any channel's DLL call throws (not a "device
    // rejected it" response - there isn't one here, sends are
    // fire-and-forget - a real bridge/hardware failure, most likely the
    // USB adapter being unplugged). ConnectionContext uses this to stop
    // trusting a stale "connected" status that only explicit connect()/
    // disconnect() calls would otherwise ever change.
    onPortLost: (callback: (error: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string): void => callback(error)
      ipcRenderer.on('dll:portLost', listener)
      return () => ipcRenderer.removeListener('dll:portLost', listener)
    }
  },
  channels: {
    list: (): Promise<number[]> => ipcRenderer.invoke('channel:list'),
    getState: (address: number): Promise<ChannelState> => ipcRenderer.invoke('channel:getState', address),
    turnOn: (address: number): Promise<void> => ipcRenderer.invoke('channel:turnOn', address),
    turnOff: (address: number): Promise<void> => ipcRenderer.invoke('channel:turnOff', address),
    setLevel: (address: number, level: Level): Promise<void> =>
      ipcRenderer.invoke('channel:setLevel', address, level),
    setMode: (address: number, mode: number): Promise<void> => ipcRenderer.invoke('channel:setMode', address, mode),
    onChanged: (callback: (state: ChannelState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: ChannelState): void => callback(state)
      ipcRenderer.on('channel:changed', listener)
      return () => ipcRenderer.removeListener('channel:changed', listener)
    }
  },
  logs: {
    // entry.sentTokens is the only "what was sent" data ever exposed to
    // the renderer - the DLL-translated values, safe to show. Raw frame
    // bytes are never part of this or any other IPC payload.
    onEntry: (callback: (entry: LogEntry) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry): void => callback(entry)
      ipcRenderer.on('log:entry', listener)
      return () => ipcRenderer.removeListener('log:entry', listener)
    },
    // Reads a page of the permanent on-disk log (see logStore.ts) -
    // deliberately no delete/clear call exposed anywhere in this API.
    getPage: (page: number, pageSize: number): Promise<LogPage> => ipcRenderer.invoke('logs:getPage', page, pageSize)
  },
  sensor: {
    listPorts: (): Promise<string[]> => ipcRenderer.invoke('sensor:listPorts'),
    getState: (): Promise<SensorState> => ipcRenderer.invoke('sensor:getState'),
    connect: (path: string): Promise<boolean> => ipcRenderer.invoke('sensor:connect', path),
    disconnect: (): Promise<void> => ipcRenderer.invoke('sensor:disconnect'),
    // Last port successfully connected to, remembered across restarts -
    // never auto-connected, just pre-selected in the port list.
    savedPort: (): Promise<string | null> => ipcRenderer.invoke('sensor:savedPort'),
    onChanged: (callback: (state: SensorState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: SensorState): void => callback(state)
      ipcRenderer.on('sensor:changed', listener)
      return () => ipcRenderer.removeListener('sensor:changed', listener)
    }
  },
  killSwitch: {
    getState: (): Promise<KillSwitchState> => ipcRenderer.invoke('killSwitch:getState'),
    resetAll: (): Promise<void> => ipcRenderer.invoke('killSwitch:resetAll'),
    resetOne: (address: number): Promise<void> => ipcRenderer.invoke('killSwitch:resetOne', address),
    manualTrip: (): Promise<void> => ipcRenderer.invoke('killSwitch:manualTrip'),
    onChanged: (callback: (state: KillSwitchState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: KillSwitchState): void => callback(state)
      ipcRenderer.on('killSwitch:changed', listener)
      return () => ipcRenderer.removeListener('killSwitch:changed', listener)
    }
  },
  branding: {
    status: (): Promise<boolean> => ipcRenderer.invoke('branding:status'),
    chooseLogo: (): Promise<boolean> => ipcRenderer.invoke('branding:chooseLogo'),
    resetLogo: (): Promise<boolean> => ipcRenderer.invoke('branding:resetLogo')
  }
}

contextBridge.exposeInMainWorld('sdr', api)

export type SdrApi = typeof api
