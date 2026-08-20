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

      {/* Sidebar is absolutely positioned (see Sidebar.tsx) - fully out of
          this flex row's layout flow so it can never stretch, squish
          siblings, or leave a partial-looking border depending on
          content height. pl-32 on the content pane just reserves enough
          left space so the floating sidebar doesn't sit on top of it. */}
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar current={current} onNavigate={onNavigate} />
        <div className="flex flex-1 flex-col overflow-hidden pl-32 pb-36">{children}</div>
      </div>

      {/* Logs floats over the page the same way Sidebar does - absolute,
          out of flow - just docked to the bottom instead of the
          top-left, and stacked above it (z-20 > Sidebar's z-10) since
          it's the higher-priority overlay for the main page. */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="w-fit rounded-t-md border border-b-0 border-border-subtle bg-white px-3 py-1 text-[10px] font-semibold text-text-muted-ref">
          Logs
        </div>
        <div className="flex h-28 flex-col border-t border-border-subtle">
          <LogsPanel />
        </div>
      </div>
    </div>
  )
}
