import { useState } from 'react'
import { Download, LayoutDashboard, List, LogOut, SlidersHorizontal, Upload, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { useConnection } from '../contexts/ConnectionContext'
import { LogoutDialog } from './LogoutDialog'
import { PAGES, type PageId } from '../layouts/pages'

interface SidebarProps {
  current: PageId
  onNavigate: (page: PageId) => void
}

const ICONS: Record<(typeof PAGES)[number]['icon'], LucideIcon> = {
  layout: LayoutDashboard,
  sliders: SlidersHorizontal,
  list: List
}

export function Sidebar({ current, onNavigate }: SidebarProps): React.JSX.Element {
  const { disconnect } = useConnection()
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [configStatus, setConfigStatus] = useState<string | null>(null)

  // "Turn Off and Close" - direct port of the C rewrite's
  // on_app_close_shutdown(): commands every channel off for real (see
  // app:turnOffAllAndQuit in main/index.ts) before quitting.
  async function handleTurnOffAndClose(): Promise<void> {
    setShowCloseConfirm(false)
    await disconnect()
    await window.sdr.app.turnOffAllAndQuit()
  }

  // "Keep Running and Close" - this dialog's original single-choice
  // behavior: quits without touching channel state, so whatever's
  // transmitting keeps transmitting after the app exits.
  async function handleKeepRunningAndClose(): Promise<void> {
    setShowCloseConfirm(false)
    await disconnect()
    await window.sdr.app.quit()
  }

  async function handleSaveConfig(): Promise<void> {
    const result = await window.sdr.config.save()
    if (!result.saved) return
    setConfigStatus('Config saved.')
    setTimeout(() => setConfigStatus(null), 3000)
  }

  async function handleLoadConfig(): Promise<void> {
    const result = await window.sdr.config.load()
    if (result === null) return
    setConfigStatus(
      result.skipped > 0
        ? `Loaded: ${result.applied} applied, ${result.skipped} skipped (kill switch tripped)`
        : `Loaded: ${result.applied} applied.`
    )
    setTimeout(() => setConfigStatus(null), 4000)
  }

  return (
    <nav className="fixed left-0 top-9 bottom-0 z-10 flex w-40 flex-col gap-2 border-r border-border-subtle bg-navy p-2">
      {PAGES.map((page) => {
        const Icon = ICONS[page.icon]
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onNavigate(page.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white transition-opacity',
              current === page.id ? 'opacity-100' : 'opacity-50 hover:opacity-80'
            )}
          >
            <Icon size={16} className="shrink-0" />
            {page.label}
          </button>
        )
      })}

      {/* Load/Save Config - direct port of the C rewrite's Commands
          panel buttons, grouped here with the other app-level (not
          per-channel) actions. A config file is the same channels.ini
          format the automatic per-restart save already uses (see
          channelStore.ts) - Save writes the current state to a
          user-picked path, Load applies one back for real. */}
      <button
        type="button"
        onClick={() => void handleLoadConfig()}
        className="mt-auto flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white opacity-50 transition-opacity hover:opacity-80"
      >
        <Download size={16} className="shrink-0" />
        Load Config
      </button>
      <button
        type="button"
        onClick={() => void handleSaveConfig()}
        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white opacity-50 transition-opacity hover:opacity-80"
      >
        <Upload size={16} className="shrink-0" />
        Save Config
      </button>
      {configStatus !== null && <p className="px-2.5 text-[10px] leading-tight text-white/70">{configStatus}</p>}

      <button
        type="button"
        onClick={() => setShowCloseConfirm(true)}
        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white opacity-50 transition-colors hover:text-status-error hover:opacity-100"
      >
        <LogOut size={16} className="shrink-0" />
        Logout
      </button>

      {showCloseConfirm && (
        <LogoutDialog
          onTurnOffAndClose={() => void handleTurnOffAndClose()}
          onKeepRunningAndClose={() => void handleKeepRunningAndClose()}
          onCancel={() => setShowCloseConfirm(false)}
        />
      )}
    </nav>
  )
}
