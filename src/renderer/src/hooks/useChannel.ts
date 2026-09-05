import { useCallback, useEffect, useState } from 'react'
import type { ChannelState } from '../../../main/channelController'
import type { Level } from '../../../main/protocol/constants'
import { useConnection } from '../contexts/ConnectionContext'
import { useSensor } from '../contexts/SensorContext'

export function useChannel(address: number): {
  state: ChannelState | null
  turnOn: () => void
  turnOff: () => void
  setLevel: (level: Level) => void
  setMode: (mode: number) => void
} {
  const [state, setState] = useState<ChannelState | null>(null)
  const { requireConnected } = useConnection()
  const { killSwitchTripped } = useSensor()

  useEffect(() => {
    let cancelled = false
    window.sdr.channels.getState(address).then((s) => {
      if (!cancelled) setState(s)
    })
    const unsubscribe = window.sdr.channels.onChanged((s) => {
      if (s.address === address) setState(s)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [address])

  // Kill-switch-tripped blocks powering on / raising a level, same as
  // the C rewrite and sdr_app - OFF (turnOff, and setLevel(0) which maps
  // to it) is never gated. Checked here, before the IPC call, so a
  // blocked action doesn't flash an optimistic UI state that then never
  // gets confirmed (the main-process side gates the same thing
  // authoritatively - see index.ts - this is just for a responsive UI).
  const turnOn = useCallback(() => {
    if (!requireConnected() || killSwitchTripped) return
    void window.sdr.channels.turnOn(address)
  }, [address, requireConnected, killSwitchTripped])
  const turnOff = useCallback(() => {
    if (!requireConnected()) return
    void window.sdr.channels.turnOff(address)
  }, [address, requireConnected])
  const setLevel = useCallback(
    (level: Level) => {
      if (!requireConnected()) return
      if (level !== 0 && killSwitchTripped) return
      void window.sdr.channels.setLevel(address, level)
    },
    [address, requireConnected, killSwitchTripped]
  )
  const setMode = useCallback(
    (mode: number) => {
      if (!requireConnected()) return
      void window.sdr.channels.setMode(address, mode)
    },
    [address, requireConnected]
  )

  return { state, turnOn, turnOff, setLevel, setMode }
}
