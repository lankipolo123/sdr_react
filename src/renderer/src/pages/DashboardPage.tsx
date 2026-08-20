import { useAllChannels } from '../hooks/useAllChannels'
import { useLogs } from '../contexts/LogsContext'
import { useConnection } from '../contexts/ConnectionContext'
import { LEVEL_LABELS, MAX_CHANNELS, type Level } from '../../../main/protocol/constants'

const STATUS_COLORS: Record<string, string> = {
  connected: '#087F23',
  connecting: '#F59E0B',
  failed: '#B00020',
  idle: '#6B7280'
}

interface DashboardCardProps {
  title: string
  className?: string
  children: React.ReactNode
}

function DashboardCard({ title, className, children }: DashboardCardProps): React.JSX.Element {
  return (
    <div className={`rounded-[10px] border border-border-subtle bg-white p-4 ${className ?? ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted-ref">{title}</div>
      {children}
    </div>
  )
}

// Every number here comes from the same IPC streams the Commands and
// Logs pages already use (channel:changed / log:entry) - aggregated
// differently, not a separate data source. Only entry.sentTokens shows
// up anywhere (Recent Activity), same confidentiality rule as the rest
// of the app - raw frame bytes never reach the renderer.
export function DashboardPage(): React.JSX.Element {
  const channels = useAllChannels()
  const { status, statusText } = useConnection()
  const logs = useLogs()

  const onCount = channels.filter((c) => c.outputOn).length

  const levelCounts: Record<Level, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (const c of channels) levelCounts[c.level] += 1

  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle
  const statusLabel = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Not Connected'

  return (
    <div className="p-4">
      <h1 className="mb-3 text-sm font-semibold text-text-dark">Dashboard</h1>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <DashboardCard title="Connection">
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor }} />
            <span className="text-sm font-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 truncate text-[10px] text-text-muted-ref">{statusText}</div>
        </DashboardCard>

        <DashboardCard title="Active Channels">
          <div className="mt-2 text-2xl font-bold text-navy">
            {onCount}
            <span className="text-sm font-normal text-text-muted-ref"> / {MAX_CHANNELS}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
            <div
              className="h-full bg-status-ok transition-[width]"
              style={{ width: `${(onCount / MAX_CHANNELS) * 100}%` }}
            />
          </div>
        </DashboardCard>

        <DashboardCard title="Signal Levels">
          <div className="mt-2 flex flex-col gap-1.5">
            {([0, 1, 2, 3] as Level[]).map((lvl) => (
              <div key={lvl} className="flex items-center gap-2 text-[11px]">
                <span className="w-14 shrink-0 text-text-muted-ref">{LEVEL_LABELS[lvl]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className="h-full bg-accent-blue transition-[width]"
                    style={{ width: `${(levelCounts[lvl] / MAX_CHANNELS) * 100}%` }}
                  />
                </div>
                <span className="w-4 shrink-0 text-right font-semibold text-text-dark">{levelCounts[lvl]}</span>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard title="Recent Activity" className="mt-3">
        {logs.length === 0 ? (
          <div className="mt-2 text-xs text-text-muted-ref">No commands sent yet.</div>
        ) : (
          <div className="mt-2 flex flex-col gap-1 font-mono text-[10px]">
            {logs.slice(0, 6).map((entry, i) => (
              <div key={`${entry.timestamp}-${i}`} className="flex gap-2">
                <span className="shrink-0 text-text-muted-ref">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="shrink-0 font-semibold text-accent-blue">CH{String(entry.address).padStart(2, '0')}</span>
                <span className="truncate text-text-dark">{entry.label}</span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
