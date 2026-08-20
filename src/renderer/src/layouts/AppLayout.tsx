import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Sidebar } from './Sidebar'
import { LogsPanel } from '../components/LogsPanel'
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
    setStatus(result !== null && result > 0 ? 'connected' : 'failed')
    setStatusText(`result=${result} text="${text}"`)
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-white text-text-dark">
      {/* Frameless window - draggable title bar region, matching
          TitleBar/ResizableContainer in the reference app. */}
      <div
        className="flex h-9 items-center justify-between bg-navy px-3 text-xs text-white"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="font-semibold">TX Controller (React)</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={current} onNavigate={onNavigate} />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>

      {/* Connection status + logs, docked to the bottom instead of a top
          bar - status/Connect button share the row with LogsPanel, which
          only ever shows DLL-translated sentTokens (never raw frame
          bytes - see LogsPanel.tsx). */}
      <div className="flex h-40 flex-col border-t border-border-subtle bg-white">
        <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle p-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'connected' ? 'bg-status-ok' : status === 'connecting' ? 'bg-warning-border' : 'bg-neutral-track'
            }`}
          />
          <span className="flex-1 truncate text-text-muted-ref">{statusText}</span>
          <Button size="sm" variant="outline" onClick={handleConnect} disabled={status === 'connecting'}>
            Connect
          </Button>
        </div>
        <LogsPanel />
      </div>
    </div>
  )
}
