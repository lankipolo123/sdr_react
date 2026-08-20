import { useCallback, useEffect, useState } from 'react'
import type { ChannelState } from '../../../main/channelController'
import type { Level } from '../../../main/protocol/constants'
import { useConnection } from '../contexts/ConnectionContext'

export function useChannel(address: number): {
  state: ChannelState | null
  turnOn: () => void
  turnOff: () => void
  setLevel: (level: Level) => void
  setMode: (mode: number) => void
} {
  const [state, setState] = useState<ChannelState | null>(null)
  const { requireConnected } = useConnection()

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

  const turnOn = useCallback(() => {
    if (!requireConnected()) return
    void window.sdr.channels.turnOn(address)
  }, [address, requireConnected])
  const turnOff = useCallback(() => {
    if (!requireConnected()) return
    void window.sdr.channels.turnOff(address)
  }, [address, requireConnected])
  const setLevel = useCallback(
    (level: Level) => {
      if (!requireConnected()) return
      void window.sdr.channels.setLevel(address, level)
    },
    [address, requireConnected]
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
