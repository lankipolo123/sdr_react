import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { LogEntry } from '../../../main/channelController'

const MAX_ENTRIES = 200

const LogsContext = createContext<LogEntry[] | null>(null)

// Single subscription for the whole app, mounted once at the root -
// the corner Logs box, the dedicated Logs page, and the Dashboard's
// Recent Activity card all read from this same accumulated list
// instead of each keeping its own local state. A component-local
// useState (the old useLogs()) only starts collecting entries from
// whenever THAT component happened to mount, so the Logs page (which
// only mounts when you navigate to it) was missing everything that
// arrived before that - this fixes that by never un-mounting the
// subscription in the first place.
export function LogsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    const unsubscribe = window.sdr.logs.onEntry((entry) => {
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES))
    })
    return unsubscribe
  }, [])

  return <LogsContext.Provider value={entries}>{children}</LogsContext.Provider>
}

export function useLogs(): LogEntry[] {
  const entries = useContext(LogsContext)
  if (entries === null) throw new Error('useLogs must be used within a LogsProvider')
  return entries
}
