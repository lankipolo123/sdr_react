import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { PortScheduler } from './portScheduler'
import { ChannelController, type ChannelState } from './channelController'
import { dllAutoConnect, dllCheckConnection, dllDisconnect, getDllLoadError } from './dll/transit'
import type { Level } from './protocol/constants'

// Scaffold phase: one real channel (address 1) wired end-to-end through
// the DLL bridge, per the "scaffold + one working channel first" plan -
// expanding to MAX_CHANNELS is just widening this map once the DLL
// bridge itself is confirmed working on real hardware.
const scheduler = new PortScheduler()
const channels = new Map<number, ChannelController>()
channels.set(1, new ChannelController(1, scheduler))

function broadcastChannelChanged(win: BrowserWindow, state: ChannelState): void {
  win.webContents.send('channel:changed', state)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 420,
    height: 560,
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const controller of channels.values()) controller.dispose()
  if (process.platform !== 'darwin') app.quit()
})
