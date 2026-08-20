import { useEffect, useState } from 'react'
import { ChannelCard } from './components/ChannelCard'
import { Button } from './components/ui/button'
import { MAX_CHANNELS } from '../../main/protocol/constants'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed'

const CHANNELS_PER_ROW = 4 // matches main_page.py's CHANNELS_PER_ROW

export function App(): React.JSX.Element {
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

  const addresses = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1)

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

      {/* Controls status row - full Query diagnostic dialog + Logs
          panel from the reference app's ControlsBar/LogsPanel are not
          built yet, this is just connection status for now. */}
      <div className="flex items-center gap-2 border-b border-border-subtle p-3 text-xs">
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

      <div className="flex-1 overflow-auto p-4">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${CHANNELS_PER_ROW}, minmax(0, 1fr))` }}
        >
          {addresses.map((address) => (
            <ChannelCard key={address} address={address} />
          ))}
        </div>
      </div>
    </div>
  )
}
