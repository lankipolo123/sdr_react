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
    <nav className="fixed left-0 top-9 bottom-0 z-10 flex w-40 flex-col gap-2 bg-navy p-2">
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

      <button
        type="button"
        onClick={() => setShowLogoutConfirm(true)}
        className={cn(
          'mt-auto flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-status-error transition-colors hover:text-status-error/80',
          // Commands page floats its Logs box at z-[1000] along the
          // bottom of the window, covering the sidebar's lower portion
          // - reserve enough bottom margin here (sized to the Logs
          // box's max height + tab) so Logout stays above it instead of
          // getting hidden underneath.
          current === 'channels' && 'mb-32'
        )}
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
