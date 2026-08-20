import { contextBridge, ipcRenderer } from 'electron'
import type { ChannelState, LogEntry } from '../main/channelController'
import type { LogPage } from '../main/logStore'
import { MAX_CHANNELS, type Level } from '../main/protocol/constants'
import type { DllCallResult } from '../main/dll/transit'

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
  dll: {
    autoConnect: (): Promise<DllCallResult> => ipcRenderer.invoke('dll:autoConnect'),
    checkConnection: (): Promise<DllCallResult> => ipcRenderer.invoke('dll:checkConnection'),
    disconnect: (): Promise<DllCallResult> => ipcRenderer.invoke('dll:disconnect'),
    loadError: (): Promise<string | null> => ipcRenderer.invoke('dll:loadError')
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
  }
}

contextBridge.exposeInMainWorld('sdr', api)

export type SdrApi = typeof api
