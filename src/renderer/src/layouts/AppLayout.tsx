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
        className="flex h-9 items-center justify-between gap-2 bg-navy px-3 text-xs text-white"
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

      {/* Sidebar (1) is a full-height rail (absolute, out of flow so it
          can't be squished). Content pane (3) fills the rest, and Logs
          (2) now lives inside it, right after the page content in
          normal flow - no more pinning to the viewport's bottom edge,
          so there's zero gap between content and Logs regardless of how
          tall the page content actually is. Skipped entirely on the
          Logs page itself (current === 'logs') since that page already
          is the full logs view - no point showing it twice. */}
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar current={current} onNavigate={onNavigate} />
        <div className="flex flex-1 flex-col overflow-y-auto pl-44">
          {children}
          {current !== 'logs' && (
            <div className="flex flex-col">
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
          )}
        </div>
      </div>
    </div>
  )
}
