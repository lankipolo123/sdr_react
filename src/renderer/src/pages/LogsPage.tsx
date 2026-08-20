import { useLogs } from '../contexts/LogsContext'

// Full, dedicated log view - a proper table instead of the compact
// single-line rows used for the small tab on ChannelsPage. Shows
// entry.sentTokens only (the DLL-translated, safe-to-show values) -
// same rule as everywhere else logs are displayed.
export function LogsPage(): React.JSX.Element {
  const entries = useLogs()

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-text-dark">Logs</h1>
        <span className="text-xs text-text-muted-ref">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-border-subtle bg-white p-8 text-center text-xs text-text-muted-ref">
          No commands sent yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-subtle bg-white">
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
    </div>
  )
}
