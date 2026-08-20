import { useState } from 'react'
import { cn } from '../lib/utils'
import { LogsPanel } from '../components/LogsPanel'
import { PAGES, type PageId } from './pages'

interface SidebarProps {
  current: PageId
  onNavigate: (page: PageId) => void
}

// One combined rail: page nav on top, a collapsible Logs section below -
// merged into a single absolutely-positioned component instead of two
// separate floating pieces (Sidebar + a bottom logs overlay) that kept
// fighting each other over size/position. logsOn is the single declared
// on/off switch for whether the logs section is expanded.
export function Sidebar({ current, onNavigate }: SidebarProps): React.JSX.Element {
  const [logsOn, setLogsOn] = useState(false)

  return (
    <nav className="absolute inset-y-0 left-0 z-10 flex w-64 flex-col border-r border-border-subtle bg-slate-50">
      <div className="flex flex-col gap-1 p-2">
        {PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onNavigate(page.id)}
            className={cn(
              'rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors',
              current === page.id
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-text-muted-ref hover:bg-border-subtle/50'
            )}
          >
            {page.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLogsOn((on) => !on)}
        className="mt-auto flex items-center justify-between border-t border-border-subtle px-3 py-2 text-[10px] font-semibold text-text-muted-ref hover:bg-border-subtle/50"
      >
        Logs
        <span>{logsOn ? '▾' : '▸'}</span>
      </button>

      {logsOn && (
        <div className="max-h-64 overflow-y-auto border-t border-border-subtle bg-white">
          <LogsPanel />
        </div>
      )}
    </nav>
  )
}
