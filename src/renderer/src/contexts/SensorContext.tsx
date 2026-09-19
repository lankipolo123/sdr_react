import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SensorState } from '../../../main/serial/sensor'
import type { KillSwitchState } from '../../../main/safety'

interface SensorContextValue {
  state: SensorState
  ports: string[]
  selectedPort: string
  setSelectedPort: (port: string) => void
  refreshPorts: () => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  killSwitchState: KillSwitchState
  isChannelTripped: (address: number) => boolean
  resetKillSwitchAll: () => Promise<void>
  resetKillSwitchOne: (address: number) => Promise<void>
  manualTripKillSwitch: () => Promise<void>
}

function initialState(): SensorState {
  return { connected: false, units: [] }
}

function initialKillSwitchState(): KillSwitchState {
  return { trippedAddresses: [] }
}

const SensorContext = createContext<SensorContextValue | null>(null)

export function SensorProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<SensorState>(initialState())
  const [ports, setPorts] = useState<string[]>([])
  const [selectedPort, setSelectedPort] = useState('')
  const [killSwitchState, setKillSwitchState] = useState<KillSwitchState>(initialKillSwitchState())

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
    window.sdr.killSwitch.getState().then(setKillSwitchState)
    window.sdr.sensor.savedPort().then((saved) => {
      if (saved !== null) setSelectedPort((prev) => prev || saved)
    })
    refreshPorts()

    const offSensor = window.sdr.sensor.onChanged(setState)
    const offKillSwitch = window.sdr.killSwitch.onChanged(setKillSwitchState)
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

  const isChannelTripped = useCallback(
    (address: number): boolean => killSwitchState.trippedAddresses.includes(address),
    [killSwitchState]
  )

  const resetKillSwitchAll = useCallback(async (): Promise<void> => {
    await window.sdr.killSwitch.resetAll()
  }, [])

  const resetKillSwitchOne = useCallback(async (address: number): Promise<void> => {
    await window.sdr.killSwitch.resetOne(address)
  }, [])

  const manualTripKillSwitch = useCallback(async (): Promise<void> => {
    await window.sdr.killSwitch.manualTrip()
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
        killSwitchState,
        isChannelTripped,
        resetKillSwitchAll,
        resetKillSwitchOne,
        manualTripKillSwitch
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
