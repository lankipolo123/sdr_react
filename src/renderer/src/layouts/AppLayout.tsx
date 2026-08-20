import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Sidebar } from './Sidebar'
import { LogsPanel } from '../components/LogsPanel'
import { cn } from '../lib/utils'
import type { PageId } from './pages'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed'

interface AppLayoutProps {
  current: PageId
  onNavigate: (page: PageId) => void
  children: React.ReactNode
}

export function AppLayout({ current, onNavigate, children }: AppLayoutProps): React.JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [statusText, setStatusText] = useState('Not connected yet.')

  useEffect(() => {
    window.sdr.dll.loadError().then((err) => {
      if (err !== null) {
        setStatus('failed')
        setStatusText(`DLL failed to load: ${err}`)
      }
    })
  }, [])

  async function handleConnect(): Promise<void> {
    setStatus('connecting')
    setStatusText('Connecting…')
    const { result, text, error } = await window.sdr.dll.autoConnect()
    if (error !== null) {
      setStatus('failed')
      setStatusText(`Error: ${error}`)
      return
    }
    // Confirmed on real hardware (32-bit DLL): attached -> returns 4,
    // "Connected"; nothing attached -> returns -1, "DisConnected". Not
    // yet re-verified against this x64 DLL - this is exactly the kind
    // of call to check first against real hardware.
    const connected = result !== null && result > 0
    setStatus(connected ? 'connected' : 'failed')
    setStatusText(connected ? 'Connected' : `Not connected (${text ?? 'no response'})`)
  }

  async function handleDisconnect(): Promise<void> {
    setStatus('connecting')
    setStatusText('Disconnecting…')
    const { error } = await window.sdr.dll.disconnect()
    if (error !== null) {
      setStatus('failed')
      setStatusText(`Error: ${error}`)
      return
    }
    setStatus('idle')
    setStatusText('Not connected yet.')
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-white text-text-dark">
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
            onClick={status === 'connected' ? handleDisconnect : handleConnect}
            disabled={status === 'connecting'}
          >
            {status === 'connected' ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={current} onNavigate={onNavigate} />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>

      {/* Logs only now - status/Connect moved to the title bar above.
          Height trimmed to the actual row height instead of a fixed h-40
          that left a lot of dead white space when there weren't many
          entries yet. */}
      <div className="flex h-28 flex-col border-t border-border-subtle bg-white">
        <LogsPanel />
      </div>
    </div>
  )
}
