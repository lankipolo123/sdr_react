import { app, shell, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { PortScheduler } from './portScheduler'
import { ChannelController, type ChannelState, type LogEntry } from './channelController'
import { loadChannelStates, saveChannelStates } from './channelStore'
import { appendLogEntry, getLogPage } from './logStore'
import { dllAutoConnect, dllCheckConnection, dllDisconnect, getDllLoadError } from './dll/transit'
import { MAX_CHANNELS, type Level } from './protocol/constants'
import { SensorController, type SensorState } from './serial/sensor'
import { SafetyController, type KillSwitchState } from './safety'
import { loadSettings, saveSettings } from './settingsStore'

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

const settingsPath = join(app.getPath('userData'), 'config', 'settings.json')
const settings = loadSettings(settingsPath)

// Amplifier temperature/humidity sensor - a real, separate raw serial
// (Modbus RTU) connection, unrelated to the RS-422/Transit.dll bus
// above. See serial/sensor.ts. The kill switch listens to it directly
// and forces every channel off the moment it reports an overtemp
// reading (safety.ts).
const sensor = new SensorController()
const safety = new SafetyController(channels)
// Rack-wide average across every sensor unit that currently has a real
// reading (see SensorController.getAverageTemperature()) - same trigger
// source as the C rewrite's check_kill_switch(), not any single unit's
// reading alone.
sensor.on('changed', () => safety.onSensorState(sensor.getAverageTemperature()))

function broadcastChannelChanged(win: BrowserWindow, state: ChannelState): void {
  win.webContents.send('channel:changed', state)
}

// LogEntry carries only sentTokens (the DLL-translated, safe-to-show
// values) - never the raw frame bytes, which never leave
// channelController.ts's private send(). Safe to broadcast wholesale.
function broadcastLogEntry(win: BrowserWindow, entry: LogEntry): void {
  win.webContents.send('log:entry', entry)
}

function broadcastPortLost(win: BrowserWindow, error: string): void {
  win.webContents.send('dll:portLost', error)
}

function broadcastSensorChanged(win: BrowserWindow, state: SensorState): void {
  win.webContents.send('sensor:changed', state)
}

function broadcastKillSwitchChanged(win: BrowserWindow, state: KillSwitchState): void {
  win.webContents.send('killSwitch:changed', state)
}

// Same dev-vs-packaged split as resolveDllPath() in dll/transit.ts:
// resources/icon.png ships via electron-builder's extraResources (see
// electron-builder.yml), landing under process.resourcesPath in a
// packaged build but staying at the repo root in dev.
function resolveDefaultIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', 'icon.png')
  }
  return join(app.getAppPath(), 'resources', 'icon.png')
}

// User-swappable override, same convention as the C rewrite's
// branding/icon.ico (see branding/README.md): a branding/icon.png
// dropped next to the installed app overrides the window/taskbar icon,
// checked once at startup. The per-user NSIS install dir
// ($LOCALAPPDATA\Programs\SDR React) is writable without elevation, so
// this works the same way post-install as it does in dev - no
// Program-Files-needs-admin trap like the one settingsStore.ts already
// avoids for app settings.
//
// This only covers the *running* app's icon, not the packaged .exe
// file's own icon as shown in Explorer - that one is baked in at build
// time from build/icon.ico (see electron-builder.yml) and would need a
// full rebuild to change, same limitation noted in the C rewrite's
// branding/README.md for its apply_icon tool.
function resolveBrandingIconPath(): string {
  const appDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
  return join(appDir, 'branding', 'icon.png')
}

function loadAppIcon(): Electron.NativeImage | undefined {
  for (const iconPath of [resolveBrandingIconPath(), resolveDefaultIconPath()]) {
    if (!existsSync(iconPath)) continue
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) return image
  }
  return undefined
}

// Re-applies the current icon (default or branding override) to every
// open window immediately, no restart needed - same "takes effect right
// away" behavior as the C rewrite's Change Logo. setIcon() is a no-op on
// macOS (window icons aren't a thing there); harmless to call regardless
// since this app targets Windows.
function applyIconToAllWindows(): void {
  const icon = loadAppIcon()
  if (icon === undefined) return
  for (const win of BrowserWindow.getAllWindows()) {
    win.setIcon(icon)
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    icon: loadAppIcon(),
    // This is just the initial guess shown before the renderer reports
    // its real content height (see the 'app:contentHeight' handler
    // below) and the window snaps to fit exactly - no more guessing
    // magic numbers that go stale every time the layout's height
    // changes. Kept reasonably close to avoid a jarring resize flash.
    width: 1040,
    height: 700,
    minWidth: 1000,
    minHeight: 500,
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

  // Fires once, right after the Commands page's first real paint (see
  // AppLayout.tsx) - snaps the window to the actual content height
  // instead of shipping a guessed constant. Only applies to THIS
  // window and only the first report, so it can't fight a manual
  // resize the user makes afterward.
  let sizedToContent = false
  const handleContentHeight = (event: Electron.IpcMainEvent, height: number): void => {
    if (sizedToContent || event.sender !== win.webContents) return
    sizedToContent = true
    const [width] = win.getContentSize()
    const [, minHeight] = win.getMinimumSize()
    win.setContentSize(width, Math.max(minHeight, Math.ceil(height)))
  }
  ipcMain.on('app:contentHeight', handleContentHeight)
  win.on('closed', () => ipcMain.removeListener('app:contentHeight', handleContentHeight))

  for (const controller of channels.values()) {
    controller.on('changed', (state: ChannelState) => broadcastChannelChanged(win, state))
    controller.on('log', (entry: LogEntry) => {
      appendLogEntry(entry, logsPath)
      broadcastLogEntry(win, entry)
    })
    controller.on('port-lost', (error: string) => broadcastPortLost(win, error))
  }

  // sensor's own disconnect() (called from portLost()) already fires
  // 'changed' with connected: false - nothing extra to forward for
  // 'portLost' itself.
  sensor.on('changed', (state: SensorState) => broadcastSensorChanged(win, state))
  safety.on('changed', (state: KillSwitchState) => broadcastKillSwitchChanged(win, state))

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
  ipcMain.handle('channel:turnOn', (_event, address: number) => {
    if (!safety.allowPowerOn(address)) return
    requireChannel(address).turnOutputOn()
  })
  // Never gated - OFF must always go through, kill-switch-tripped or not.
  ipcMain.handle('channel:turnOff', (_event, address: number) => requireChannel(address).turnOutputOff())
  ipcMain.handle('channel:setLevel', (_event, address: number, level: Level) => {
    if (level !== 0 && !safety.allowPowerOn(address)) return
    requireChannel(address).setLevel(level)
  })
  ipcMain.handle('channel:setMode', (_event, address: number, mode: number) =>
    requireChannel(address).setMode(mode)
  )

  ipcMain.handle('logs:getPage', (_event, page: number, pageSize: number) => getLogPage(page, pageSize, logsPath))

  ipcMain.handle('sensor:listPorts', () => SensorController.listPorts())
  ipcMain.handle('sensor:getState', () => sensor.getState())
  ipcMain.handle('sensor:connect', async (_event, path: string) => {
    const ok = await sensor.connect(path)
    if (ok) {
      settings.sensorPort = path
      saveSettings(settings, settingsPath)
    }
    return ok
  })
  ipcMain.handle('sensor:disconnect', () => sensor.disconnect())
  ipcMain.handle('sensor:savedPort', () => settings.sensorPort)

  ipcMain.handle('killSwitch:getState', () => safety.getState())
  ipcMain.handle('killSwitch:resetAll', () => safety.resetAll())
  ipcMain.handle('killSwitch:resetOne', (_event, address: number) => safety.resetOne(address))
  // Same rack-wide effect as an automatic overtemp trip, for testing
  // without needing the average to actually cross the threshold. The
  // confirmation dialog lives in the renderer (ForceTripDialog) - this
  // handler trusts that it was only invoked after the user confirmed.
  ipcMain.handle('killSwitch:manualTrip', () => safety.manualTripAll())

  ipcMain.handle('branding:status', () => existsSync(resolveBrandingIconPath()))
  ipcMain.handle('branding:chooseLogo', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a logo image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'ico'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return false

    const source = nativeImage.createFromPath(result.filePaths[0])
    if (source.isEmpty()) return false

    // Square down to a standard icon size - resize() only ever scales
    // the loaded image, never touches the source file itself.
    const resized = source.resize({ width: 256, height: 256 })
    const brandingPath = resolveBrandingIconPath()
    mkdirSync(dirname(brandingPath), { recursive: true })
    writeFileSync(brandingPath, resized.toPNG())
    applyIconToAllWindows()
    return true
  })
  ipcMain.handle('branding:resetLogo', () => {
    const brandingPath = resolveBrandingIconPath()
    if (existsSync(brandingPath)) rmSync(brandingPath)
    applyIconToAllWindows()
    return true
  })

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
  sensor.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
