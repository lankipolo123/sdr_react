import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SensorState } from '../../../main/serial/sensor'

interface SensorContextValue {
  state: SensorState
  ports: string[]
  selectedPort: string
  setSelectedPort: (port: string) => void
  refreshPorts: () => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  killSwitchTripped: boolean
  resetKillSwitch: () => Promise<void>
}

function initialState(): SensorState {
  return {
    connected: false,
    online: false,
    hasReading: false,
    temperatureC: 0,
    humidityPct: 0,
    attemptCount: 0,
    lastRxLen: 0
  }
}

const SensorContext = createContext<SensorContextValue | null>(null)

export function SensorProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<SensorState>(initialState())
  const [ports, setPorts] = useState<string[]>([])
  const [selectedPort, setSelectedPort] = useState('')
  const [killSwitchTripped, setKillSwitchTripped] = useState(false)

  const refreshPorts = useCallback((): void => {
    window.sdr.sensor.listPorts().then((list) => {
      setPorts(list)
      // Keep whatever was selected (loaded from settings, or picked by
      // hand) across a refresh instead of always jumping to the first
      // port - a plugged-in device shouldn't silently switch ports just
      // because the list got rebuilt.
      setSelectedPort((prev) => (list.includes(prev) ? prev : list[0] ?? ''))
    })
  }, [])

  useEffect(() => {
    window.sdr.sensor.getState().then(setState)
    window.sdr.killSwitch.getState().then(setKillSwitchTripped)
    window.sdr.sensor.savedPort().then((saved) => {
      if (saved !== null) setSelectedPort((prev) => prev || saved)
    })
    refreshPorts()

    const offSensor = window.sdr.sensor.onChanged(setState)
    const offKillSwitch = window.sdr.killSwitch.onChanged(setKillSwitchTripped)
    return () => {
      offSensor()
      offKillSwitch()
    }
  }, [refreshPorts])

  const connect = useCallback(async (): Promise<void> => {
    if (!selectedPort) return
    await window.sdr.sensor.connect(selectedPort)
  }, [selectedPort])

  const disconnect = useCallback(async (): Promise<void> => {
    await window.sdr.sensor.disconnect()
  }, [])

  const resetKillSwitch = useCallback(async (): Promise<void> => {
    await window.sdr.killSwitch.reset()
  }, [])

  return (
    <SensorContext.Provider
      value={{
        state,
        ports,
        selectedPort,
        setSelectedPort,
        refreshPorts,
        connect,
        disconnect,
        killSwitchTripped,
        resetKillSwitch
      }}
    >
      {children}
    </SensorContext.Provider>
  )
}

export function useSensor(): SensorContextValue {
  const ctx = useContext(SensorContext)
  if (ctx === null) throw new Error('useSensor must be used within a SensorProvider')
  return ctx
}
