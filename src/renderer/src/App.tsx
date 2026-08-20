import { useEffect, useState } from 'react'
import { ChannelCard } from './components/ChannelCard'
import { Button } from './components/ui/button'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed'

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

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Frameless window - draggable title bar region, per the rewrite
          guide's Electron frame:false approach. */}
      <div className="flex h-9 items-center justify-between border-b border-border px-3 text-xs" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span className="font-semibold">SDR React (scaffold)</span>
      </div>

      <div className="flex items-center gap-2 border-b border-border p-3 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${
            status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-orange-400' : 'bg-muted-foreground/40'
          }`}
        />
        <span className="flex-1 truncate text-muted-foreground">{statusText}</span>
        <Button size="sm" variant="outline" onClick={handleConnect} disabled={status === 'connecting'}>
          Connect
        </Button>
      </div>

      <div className="flex flex-1 items-start justify-center p-6">
        <ChannelCard address={1} />
      </div>
    </div>
  )
}
