import { useState } from 'react'
import { LayoutDashboard, List, LogOut, SlidersHorizontal, type LucideIcon } from 'lucide-react'
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  async function handleLogout(): Promise<void> {
    setShowLogoutConfirm(false)
    await disconnect()
    await window.sdr.app.quit()
  }

  return (
    <nav className="fixed left-0 top-9 bottom-0 z-10 flex w-40 flex-col gap-2 border-r border-border-subtle bg-slate-50 p-2">
      {PAGES.map((page) => {
        const Icon = ICONS[page.icon]
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onNavigate(page.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors',
              current === page.id ? 'text-accent-blue' : 'text-text-muted-ref hover:text-text-dark'
            )}
          >
            <Icon size={16} className="shrink-0" />
            {page.label}
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => setShowLogoutConfirm(true)}
        className="mt-auto flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-status-error transition-colors hover:text-status-error/80"
      >
        <LogOut size={16} className="shrink-0" />
        Logout
      </button>

      {showLogoutConfirm && (
        <LogoutDialog onConfirm={() => void handleLogout()} onCancel={() => setShowLogoutConfirm(false)} />
      )}
    </nav>
  )
}
