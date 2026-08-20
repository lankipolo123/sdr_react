import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { PortScheduler } from './portScheduler'
import { ChannelController, type ChannelState, type LogEntry } from './channelController'
import { loadChannelStates, saveChannelStates } from './channelStore'
import { appendLogEntry, getLogPage } from './logStore'
import { dllAutoConnect, dllCheckConnection, dllDisconnect, getDllLoadError } from './dll/transit'
import { MAX_CHANNELS, type Level } from './protocol/constants'

// Direct port of the reference app's channels.ini persistence (see
// channelStore.ts) - remembers each channel's last mode/level/output
// state across restarts. Lives under Electron's own userData dir
// rather than alongside the app bundle, matching the reference app's
// own user_data_dir() convention.
const channelsIniPath = join(app.getPath('userData'), 'config', 'channels.ini')
const savedChannelStates = loadChannelStates(channelsIniPath)

// Permanent internal command log (see logStore.ts) - distinct from the
// live 'log:entry' IPC stream broadcastChannelChanged's sibling below
// still sends for the ephemeral corner-box/Dashboard view. Every entry
// gets appended here too, on disk, with no delete/clear path exposed
// anywhere in this app.
const logsPath = join(app.getPath('userData'), 'logs', 'commands.jsonl')

// All 16 channels live from launch - matches the reference app's own
// "blind send" architecture (main_page.py: `for address in
// range(MAX_CHANNELS): self._build_card(address)`, no discovery step).
// Address 1-16 is used directly as both the map key and the wire ADDR
// byte (the reference app keeps a separate 0-based internal address
// with a +1 display_number - not needed here since nothing else in
// this codebase depends on 0-based indexing).
const scheduler = new PortScheduler()
const channels = new Map<number, ChannelController>()
for (let address = 1; address <= MAX_CHANNELS; address++) {
  channels.set(address, new ChannelController(address, scheduler, savedChannelStates.get(address)))
}

function broadcastChannelChanged(win: BrowserWindow, state: ChannelState): void {
  win.webContents.send('channel:changed', state)
}

// LogEntry carries only sentTokens (the DLL-translated, safe-to-show
// values) - never the raw frame bytes, which never leave
// channelController.ts's private send(). Safe to broadcast wholesale.
function broadcastLogEntry(win: BrowserWindow, entry: LogEntry): void {
  win.webContents.send('log:entry', entry)
}

function createWindow(): void {
  const win = new BrowserWindow({
    // Matches the reference app's own default/minimum window size
    // (pages/main_page.py: resize(1040, 780), setMinimumSize(1000, 700)).
    width: 1040,
    height: 780,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    webPreferences: {
      // electron-vite builds preload as ESM (out/preload/index.mjs, not
      // .js) because package.json has "type": "module" - referencing
      // .js here silently fails to load the preload script at all
      // (Electron just skips a preload path it can't find, no error
      // surfaced to the renderer), which is why contextBridge never ran
      // and window.sdr was undefined, crashing every component that
      // touched it on mount.
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  for (const controller of channels.values()) {
    controller.on('changed', (state: ChannelState) => broadcastChannelChanged(win, state))
    controller.on('log', (entry: LogEntry) => {
      appendLogEntry(entry, logsPath)
      broadcastLogEntry(win, entry)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function requireChannel(address: number): ChannelController {
  const controller = channels.get(address)
  if (controller === undefined) {
    throw new Error(`No channel controller for address ${address}`)
  }
  return controller
}

app.whenReady().then(() => {
  ipcMain.handle('dll:autoConnect', () => dllAutoConnect())
  ipcMain.handle('dll:checkConnection', () => dllCheckConnection())
  ipcMain.handle('dll:disconnect', () => dllDisconnect())
  ipcMain.handle('dll:loadError', () => getDllLoadError())

  ipcMain.handle('channel:list', () => Array.from(channels.keys()))
  ipcMain.handle('channel:getState', (_event, address: number) => requireChannel(address).getState())
  ipcMain.handle('channel:turnOn', (_event, address: number) => requireChannel(address).turnOutputOn())
  ipcMain.handle('channel:turnOff', (_event, address: number) => requireChannel(address).turnOutputOff())
  ipcMain.handle('channel:setLevel', (_event, address: number, level: Level) =>
    requireChannel(address).setLevel(level)
  )
  ipcMain.handle('channel:setMode', (_event, address: number, mode: number) =>
    requireChannel(address).setMode(mode)
  )

  ipcMain.handle('logs:getPage', (_event, page: number, pageSize: number) => getLogPage(page, pageSize, logsPath))

  // Triggers the normal window-all-closed path below (channel state
  // save + controller disposal) rather than duplicating that logic -
  // app.quit() closes every window first, which fires it naturally.
  ipcMain.handle('app:quit', () => app.quit())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  saveChannelStates(
    Array.from(channels.values()).map((controller) => controller.getState()),
    channelsIniPath
  )
  for (const controller of channels.values()) controller.dispose()
  if (process.platform !== 'darwin') app.quit()
})
