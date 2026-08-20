import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { LogEntry } from '../../../main/channelController'

const MAX_ENTRIES = 200

const LogsContext = createContext<LogEntry[] | null>(null)

// Live, ephemeral log feed for the Commands page's corner box and
// Dashboard's Recent Activity - "today's session" view, not the
// permanent record. That's LogsPage.tsx instead, which reads a
// separate, append-only on-disk log via IPC pagination (see
// main/logStore.ts) rather than this in-memory list, and has no
// clear/delete action anywhere. This context intentionally has no
// clear function either - if you want it gone, it disappears on its
// own once you close the app.
//
// Single subscription for the whole app, mounted once at the root -
// every consumer reads the same accumulated list instead of each
// keeping its own component-local copy (a local useState per consumer
// only accumulates from whenever that specific component mounted,
// which caused a real desync between the corner box and the Logs page
// before this was centralized).
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
