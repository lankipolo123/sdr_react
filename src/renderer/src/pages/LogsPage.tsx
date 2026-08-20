import { useEffect, useState } from 'react'
import type { LogEntry } from '../../../main/channelController'

const PAGE_SIZE = 15

// Reads the permanent, on-disk internal log (see main/logStore.ts) a
// page at a time via IPC instead of holding the whole history in
// renderer memory - scales with the log file, not with how long the
// app has been running. Distinct from the live LogsContext used by
// the corner box on the Commands page and Dashboard's Recent
// Activity, which stays an ephemeral, session-only feed ("today's
// logs"); this page is the permanent record and deliberately has no
// clear/delete action anywhere in it.
export function LogsPage(): React.JSX.Element {
  const [page, setPage] = useState(0)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.sdr.logs.getPage(page, PAGE_SIZE).then((result) => {
      if (!cancelled) {
        setEntries(result.entries)
        setTotal(result.total)
      }
    })
    return () => {
      cancelled = true
    }
  }, [page])

  // Keep the newest page live: a fresh command bumps the count
  // everywhere, and if we're actually looking at page 0 (the most
  // recent entries), prepend it there too instead of requiring a
  // manual refresh to see it.
  useEffect(() => {
    const unsubscribe = window.sdr.logs.onEntry((entry) => {
      setTotal((t) => t + 1)
      if (page === 0) {
        setEntries((prev) => [entry, ...prev].slice(0, PAGE_SIZE))
      }
    })
    return unsubscribe
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-text-dark">Logs</h1>
        <span className="text-xs text-text-muted-ref">{total} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-navy bg-white p-8 text-center text-xs text-text-muted-ref">
          No commands sent yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-navy bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-text-muted-ref">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Command</th>
                <th className="px-3 py-2">Sent Values</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={`${entry.timestamp}-${i}`}
                  className={i % 2 === 1 ? 'bg-yellow-100' : 'border-b border-border-subtle'}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-text-muted-ref">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-accent-blue">
                    CH{String(entry.address).padStart(2, '0')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-dark">{entry.label}</td>
                  <td className="px-3 py-2 font-mono text-text-muted-ref">{entry.sentTokens.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-border-subtle px-2 py-1 font-semibold text-text-muted-ref disabled:pointer-events-none disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-text-muted-ref">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-border-subtle px-2 py-1 font-semibold text-text-muted-ref disabled:pointer-events-none disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
