import { useState } from 'react'
import { useLogs, useClearLogs } from '../contexts/LogsContext'

const PAGE_SIZE = 15

// Full, dedicated log view - a proper table instead of the compact
// single-line rows used for the small tab on ChannelsPage. Shows
// entry.sentTokens only (the DLL-translated, safe-to-show values) -
// same rule as everywhere else logs are displayed.
export function LogsPage(): React.JSX.Element {
  const entries = useLogs()
  const clearLogs = useClearLogs()
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageEntries = entries.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-text-dark">Logs</h1>
        <span className="text-xs text-text-muted-ref">{entries.length} entries</span>
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
              {pageEntries.map((entry, i) => (
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

      {entries.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={clearLogs}
            className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
          >
            Clear Log
          </button>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded-md border border-border-subtle px-2 py-1 font-semibold text-text-muted-ref disabled:pointer-events-none disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-text-muted-ref">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded-md border border-border-subtle px-2 py-1 font-semibold text-text-muted-ref disabled:pointer-events-none disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
