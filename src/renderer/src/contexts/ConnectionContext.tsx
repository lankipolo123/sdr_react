import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { PortNotActivePrompt } from '../components/PortNotActivePrompt'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed'

interface ConnectionContextValue {
  status: ConnectionStatus
  statusText: string
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  // Gate for anything that's about to send to the DLL (channel on/off,
  // level, mode). Returns true when already connected, so the caller
  // just proceeds; when not connected, pops the "activate the port"
  // prompt instead and returns false so the caller skips the send
  // rather than firing it into a dead DLL connection.
  requireConnected: () => boolean
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

export function ConnectionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [statusText, setStatusText] = useState('Not connected yet.')
  const [showPortPrompt, setShowPortPrompt] = useState(false)

  useEffect(() => {
    window.sdr.dll.loadError().then((err) => {
      if (err !== null) {
        setStatus('failed')
        setStatusText(`DLL failed to load: ${err}`)
      }
    })
  }, [])

  const connect = useCallback(async (): Promise<void> => {
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
  }, [])

  const disconnect = useCallback(async (): Promise<void> => {
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
  }, [])

  const requireConnected = useCallback((): boolean => {
    if (status === 'connected') return true
    setShowPortPrompt(true)
    return false
  }, [status])

  return (
    <ConnectionContext.Provider value={{ status, statusText, connect, disconnect, requireConnected }}>
      {children}
      {showPortPrompt && (
        <PortNotActivePrompt
          onConnect={() => {
            setShowPortPrompt(false)
            void connect()
          }}
          onDismiss={() => setShowPortPrompt(false)}
        />
      )}
    </ConnectionContext.Provider>
  )
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext)
  if (ctx === null) throw new Error('useConnection must be used within a ConnectionProvider')
  return ctx
}
