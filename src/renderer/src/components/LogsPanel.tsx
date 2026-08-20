import { useLogs } from '../hooks/useLogs'

// Shows only entry.sentTokens - the DLL-translated values that
// CommandTokens/SendCommandToSDR actually transmitted. These are the
// safe, intended-to-be-visible substitution values; the raw/logical
// protocol frame bytes never reach the renderer at all, so there is
// nothing here that could expose the real protocol.
export function LogsPanel(): React.JSX.Element {
  const entries = useLogs()

  return (
    <div className="font-mono text-[9px] leading-relaxed">
      {entries.length === 0 ? (
        <div className="p-2 text-text-muted-ref">No commands sent yet.</div>
      ) : (
        entries.map((entry, i) => {
          // 1st, 3rd, 5th... row (0-indexed even) stays uncolored; 2nd,
          // 4th... row (0-indexed odd) gets the yellow zebra stripe.
          const isEvenRow = i % 2 === 1
          return (
            <div key={`${entry.timestamp}-${i}`} className={`px-2 py-1 ${isEvenRow ? 'bg-yellow-100 text-black' : ''}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-accent-blue">CH{String(entry.address).padStart(2, '0')}</span>
                <span className={isEvenRow ? '' : 'text-text-muted-ref'}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className={isEvenRow ? 'truncate' : 'truncate text-text-dark'}>{entry.label}</div>
              <div className={isEvenRow ? 'truncate' : 'truncate text-text-muted-ref'}>{entry.sentTokens.join(' ')}</div>
            </div>
          )
        })
      )}
    </div>
  )
}
