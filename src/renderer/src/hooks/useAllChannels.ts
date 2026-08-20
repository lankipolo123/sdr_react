import { useEffect, useState } from 'react'
import type { ChannelState } from '../../../main/channelController'

// Same channel:changed IPC stream each ChannelCard already listens to,
// just aggregated into one list instead of one hook per address - for
// dashboard-level stats (how many are on, level breakdown, etc.)
// instead of controlling a single channel.
export function useAllChannels(): ChannelState[] {
  const [states, setStates] = useState<Map<number, ChannelState>>(new Map())

  useEffect(() => {
    let cancelled = false
    window.sdr.channels.list().then((addresses) => {
      for (const address of addresses) {
        window.sdr.channels.getState(address).then((state) => {
          if (!cancelled) setStates((prev) => new Map(prev).set(address, state))
        })
      }
    })
    const unsubscribe = window.sdr.channels.onChanged((state) => {
      setStates((prev) => new Map(prev).set(state.address, state))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return Array.from(states.values()).sort((a, b) => a.address - b.address)
}
