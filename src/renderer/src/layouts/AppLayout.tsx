import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Sidebar } from './Sidebar'
import { LogsPanel } from '../components/LogsPanel'
import { cn } from '../lib/utils'
import { useConnection } from '../contexts/ConnectionContext'
import type { PageId } from './pages'

interface AppLayoutProps {
  current: PageId
  onNavigate: (page: PageId) => void
  children: React.ReactNode
}

export function AppLayout({ current, onNavigate, children }: AppLayoutProps): React.JSX.Element {
  const { status, statusText, connect, disconnect } = useConnection()
  const [logsOpen, setLogsOpen] = useState(true)

  return (
    <div className="relative flex h-screen w-screen flex-col bg-white text-text-dark">
      {/* Frameless window - draggable title bar region, matching
          TitleBar/ResizableContainer in the reference app. Connection
          status + Connect button live here now instead of their own row -
          the button sits in a no-drag island so it stays clickable inside
          the draggable bar. */}
      <div
        className="flex h-9 items-center justify-between gap-2 bg-navy px-3 text-xs text-white outline outline-2 -outline-offset-2 outline-red-500"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="font-semibold">TX Controller (React)</span>
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'connected' ? 'bg-status-ok' : status === 'connecting' ? 'bg-warning-border' : 'bg-neutral-track'
            }`}
          />
          <span className="max-w-[280px] truncate text-white/80">{statusText}</span>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'h-6 px-2 text-[10px]',
              status === 'connected'
                ? 'border-status-error bg-status-error text-white hover:bg-status-error/90'
                : 'border-status-ok bg-status-ok text-white hover:bg-status-ok/90'
            )}
            onClick={status === 'connected' ? disconnect : connect}
            disabled={status === 'connecting'}
          >
            {status === 'connected' ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </div>

      {/* Three self-contained panels: Sidebar (1) and the content pane
          (3) side by side, Logs (2) as a full-width bar underneath both,
          absolutely positioned with a high z-index so it always sits on
          top regardless of what's under it - no ambiguity about
          stacking order against the sidebar or the grid. */}
      <div className="relative flex flex-1 overflow-hidden outline outline-2 -outline-offset-2 outline-blue-500">
        <Sidebar current={current} onNavigate={onNavigate} />
        <div className="flex flex-1 flex-col overflow-hidden pl-44 outline outline-2 -outline-offset-2 outline-purple-500">
          {children}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col outline outline-2 -outline-offset-2 outline-orange-500">
        <button
          type="button"
          onClick={() => setLogsOpen((open) => !open)}
          className="w-fit rounded-t-md border border-b-0 border-border-subtle bg-white px-3 py-1 text-[10px] font-semibold text-text-muted-ref hover:bg-border-subtle/50"
        >
          Logs
        </button>
        {logsOpen && (
          <div className="max-h-40 overflow-y-auto rounded-b-md border border-border-subtle bg-white">
            <LogsPanel />
          </div>
        )}
      </div>
    </div>
  )
}
