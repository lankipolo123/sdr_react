import { Button } from '../components/ui/button'
import { Sidebar } from '../components/Sidebar'
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

  return (
    <div className="relative flex h-screen w-screen flex-col bg-white text-text-dark">
      {/* Frameless window - draggable title bar region, matching
          TitleBar/ResizableContainer in the reference app. Connection
          status + Connect button live here now instead of their own row -
          the button sits in a no-drag island so it stays clickable inside
          the draggable bar. */}
      <div
        className="flex h-9 items-center justify-between gap-2 border-b border-border-subtle bg-navy px-3 text-xs text-white"
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

      {/* Sidebar (1) is `fixed` (see Sidebar.tsx) - pinned to the
          viewport, decoupled from this content column's height.
          Logs (2) now gets the same pl-44 as the content pane, so it
          starts exactly where the content starts and never extends
          under the sidebar's column - plain block below the main page,
          nothing to overlap, no z-index trick needed. Skipped on the
          Logs page itself since that page already is the full logs
          view - same reasoning for the dashboard page.

          This outer row no longer scrolls as a whole (overflow-hidden)
          - the content pane below has its own overflow-y-auto instead,
          so scrolling through channel cards can't drag the Logs box
          (or vice versa) along with it. Each scrolls independently. */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Sidebar current={current} onNavigate={onNavigate} />
        <div className="flex-1 overflow-y-auto pl-44">{children}</div>
        {current !== 'logs' && current !== 'dashboard' && (
          <div className="flex flex-col pl-44">
            <div className="w-fit rounded-t-md border border-b-0 border-border-subtle bg-white px-3 py-1 text-[10px] font-semibold text-text-muted-ref">
              Logs
            </div>
            {/* min-h keeps at least ~3 rows visible even with few
                entries; once entries grow past max-h, this scrolls on
                its own instead of pushing the whole page. */}
            <div className="min-h-[76px] max-h-56 overflow-y-auto rounded-b-md border border-border-subtle bg-white">
              <LogsPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
