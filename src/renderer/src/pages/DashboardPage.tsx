import { Plug, Radio, SignalHigh, History, Thermometer, Grid2x2, type LucideIcon } from 'lucide-react'
import { useAllChannels } from '../hooks/useAllChannels'
import { useLogs } from '../contexts/LogsContext'
import { useConnection } from '../contexts/ConnectionContext'
import { useSensor } from '../contexts/SensorContext'
import { SensorHeatmap } from '../components/SensorHeatmap'
import { BrandingCard } from '../components/BrandingCard'
import { averageTemperature } from '../lib/sensor'
import { LEVEL_LABELS, MAX_CHANNELS, type Level } from '../../../main/protocol/constants'

const STATUS_COLORS: Record<string, string> = {
  connected: '#087F23',
  connecting: '#F59E0B',
  failed: '#B00020',
  idle: '#6B7280'
}

const GAUGE_MAX_C = 80
// Confirmed thresholds: 0-19 white/freezing, 20-39 green/low, 40-55
// blue, 56-65 orange, 66+ red - same bands as the C rewrite and
// sdr_app. Drives the numeric reading's text color; the gauge bar
// itself uses a few smoother interpolation stops for a nicer blend
// between the same colors (see the inline gradient below).
function tempBandColor(tempC: number): string {
  if (tempC < 20) return '#6B7280'
  if (tempC < 40) return '#16A34A'
  if (tempC < 56) return '#2563EB'
  if (tempC < 66) return '#D97706'
  return '#DC2626'
}

interface DashboardCardProps {
  title: string
  icon: LucideIcon
  className?: string
  children: React.ReactNode
}

function DashboardCard({ title, icon: Icon, className, children }: DashboardCardProps): React.JSX.Element {
  return (
    <div className={`rounded-[10px] border border-border-subtle bg-white p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted-ref">
        <Icon size={13} className="text-accent-blue" />
        {title}
      </div>
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
  const {
    state: sensorState,
    ports,
    selectedPort,
    setSelectedPort,
    refreshPorts,
    connect: sensorConnect,
    disconnect: sensorDisconnect
  } = useSensor()

  const onCount = channels.filter((c) => c.outputOn).length

  const levelCounts: Record<Level, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (const c of channels) levelCounts[c.level] += 1

  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle
  const statusLabel = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Not Connected'
  const avgTempC = averageTemperature(sensorState.units)

  return (
    <div className="p-4">
      <h1 className="mb-3 text-sm font-semibold text-text-dark">Dashboard</h1>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <DashboardCard title="Connection" icon={Plug}>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor }} />
            <span className="text-sm font-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 truncate text-[10px] text-text-muted-ref">{statusText}</div>
        </DashboardCard>

        <DashboardCard title="Active Channels" icon={Radio}>
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

        <DashboardCard title="Signal Levels" icon={SignalHigh}>
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

        <BrandingCard />
      </div>

      <DashboardCard title="Amplifier Temperature (Avg)" icon={Thermometer} className="mt-3">
        <div className="mt-2 flex items-center gap-1.5">
          <select
            className="h-7 min-w-0 flex-1 rounded-md border border-border-subtle bg-white px-2 text-xs text-text-dark"
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
          >
            {ports.length === 0 && <option value="">No ports found</option>}
            {ports.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="h-7 shrink-0 rounded-md border border-border-subtle bg-white px-2.5 text-xs text-text-dark"
            onClick={refreshPorts}
          >
            Refresh
          </button>
          <button
            type="button"
            className="h-7 shrink-0 rounded-md bg-navy px-3 text-xs font-semibold text-white"
            onClick={sensorState.connected ? sensorDisconnect : sensorConnect}
          >
            {sensorState.connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div
            className="relative h-3.5 min-w-[80px] flex-1 rounded-full border border-border-subtle"
            style={{
              background:
                'linear-gradient(to right, #FFFFFF 0%, #22C55E 25%, #3B82F6 60%, #F59E0B 76.25%, #DC2626 100%)'
            }}
          >
            {avgTempC !== null && (
              <div
                className="absolute -top-0.5 h-[18px] w-[2px] -translate-x-px bg-[#14161A]"
                style={{ left: `${Math.max(0, Math.min(100, (avgTempC / GAUGE_MAX_C) * 100))}%` }}
              />
            )}
          </div>
          <span
            className="min-w-[46px] text-sm font-bold"
            style={{ color: avgTempC !== null ? tempBandColor(avgTempC) : undefined }}
          >
            {avgTempC !== null ? `${avgTempC.toFixed(1)} C` : '-'}
          </span>
          <span className="whitespace-nowrap text-[11px] text-text-muted-ref">
            {avgTempC !== null
              ? `Across ${sensorState.units.filter((u) => u.hasReading).length}/${sensorState.units.length} bays`
              : sensorState.connected
                ? 'Reading…'
                : 'No readings yet'}
          </span>
        </div>
      </DashboardCard>

      <DashboardCard title="Sensor Heatmap" icon={Grid2x2} className="mt-3">
        <SensorHeatmap units={sensorState.units} />
      </DashboardCard>

      <DashboardCard title="Recent Activity" icon={History} className="mt-3">
        {logs.length === 0 ? (
          <div className="mt-2 text-xs text-text-muted-ref">No commands sent yet.</div>
        ) : (
          <div className="mt-2 flex flex-col gap-1 font-mono text-[10px]">
            {logs.slice(0, 6).map((entry, i) => (
              <div key={`${entry.timestamp}-${i}`} className="flex gap-2">
                <span className="shrink-0 text-text-muted-ref">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="shrink-0 font-semibold text-accent-blue">CH{String(entry.address).padStart(2, '0')}</span>
                <span className="shrink-0 text-text-dark">{entry.label}</span>
                <span className="truncate text-text-muted-ref">{entry.sentTokens.join(' ')}</span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
