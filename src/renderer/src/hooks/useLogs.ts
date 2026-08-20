import { useEffect, useState } from 'react'
import type { LogEntry } from '../../../main/channelController'

const MAX_ENTRIES = 200

export function useLogs(): LogEntry[] {
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    const unsubscribe = window.sdr.logs.onEntry((entry) => {
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES))
    })
    return unsubscribe
  }, [])

  return entries
}
