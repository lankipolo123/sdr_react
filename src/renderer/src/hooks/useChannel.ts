import { useCallback, useEffect, useState } from 'react'
import type { ChannelState } from '../../../main/channelController'
import type { Level } from '../../../main/protocol/constants'

export function useChannel(address: number): {
  state: ChannelState | null
  turnOn: () => void
  turnOff: () => void
  setLevel: (level: Level) => void
  setMode: (mode: number) => void
} {
  const [state, setState] = useState<ChannelState | null>(null)

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
    void window.sdr.channels.turnOn(address)
  }, [address])
  const turnOff = useCallback(() => {
    void window.sdr.channels.turnOff(address)
  }, [address])
  const setLevel = useCallback(
    (level: Level) => {
      void window.sdr.channels.setLevel(address, level)
    },
    [address]
  )
  const setMode = useCallback(
    (mode: number) => {
      void window.sdr.channels.setMode(address, mode)
    },
    [address]
  )

  return { state, turnOn, turnOff, setLevel, setMode }
}
