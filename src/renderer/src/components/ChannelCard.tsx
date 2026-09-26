import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { PowerButton } from './ui/power-button'
import { LevelSlider } from './ui/slider'
import { cn, formatUptime } from '../lib/utils'
import { useChannel } from '../hooks/useChannel'
import { useConnection } from '../contexts/ConnectionContext'
import { useSensor } from '../contexts/SensorContext'
import { useSelection } from '../contexts/SelectionContext'
import { LEVEL_LABELS, MODE_NAMES, MODE_WHITE_NOISE, type Level } from '../../../main/protocol/constants'

// Matches components/level_slider.py's SLIDER_SEND_DEBOUNCE_MS - avoids
// firing a DLL send on every intermediate value while dragging.
const SLIDER_SEND_DEBOUNCE_MS = 250

interface ChannelCardProps {
  address: number
}

export function ChannelCard({ address }: ChannelCardProps): React.JSX.Element {
  const { state, turnOn, turnOff, setLevel } = useChannel(address)
  const { status: connectionStatus } = useConnection()
  const { isChannelTripped, resetKillSwitchOne } = useSensor()
  const { isSelected, toggle } = useSelection()
  const tripped = isChannelTripped(address)
  const selected = isSelected(address)

  // Live-ticking "Up HH:MM:SS" odometer (see channelController.ts's
  // uptimeSeconds - always freshly computed as of the last IPC update,
  // not itself live). Ticks locally once a second while the channel is
  // actually ON (state.outputOn, NOT the connection-gated `isOn` below -
  // uptime is an odometer fact about the hardware, same as the C
  // rewrite's WM_TIMER accounting, independent of whether this app is
  // currently connected to it) and resyncs to the authoritative value
  // whenever a real state update arrives.
  const [liveUptime, setLiveUptime] = useState(0)
  useEffect(() => {
    if (state === null) return
    setLiveUptime(state.uptimeSeconds)
    if (!state.outputOn) return
    const interval = setInterval(() => setLiveUptime((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [state?.uptimeSeconds, state?.outputOn])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSliderChange(value: number): void {
    const level = value as Level
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setLevel(level), SLIDER_SEND_DEBOUNCE_MS)
  }

  if (state === null) {
    return (
      <div className="w-full min-w-[180px] rounded-[10px] border border-border-subtle bg-white p-3 text-xs text-text-muted-ref">
        Loading CH{String(address).padStart(2, '0')}…
      </div>
    )
  }

  // Restored channels.ini state (state.outputOn) reflects what the app
  // last knew, but the hardware isn't actually reachable until a real
  // DLL connection exists - showing it as live/green before that would
  // be misleading (same fix as the C rewrite's channel_restore_saved()
  // display gating).
  const isOn = state.outputOn && connectionStatus === 'connected'
  const level = state.level
  const statusText = tripped ? 'TRIPPED' : state.busy ? 'SENDING…' : isOn ? LEVEL_LABELS[level].toUpperCase() : 'STANDBY'
  const statusColor = tripped ? '#B00020' : state.busy ? '#64AAFF' : isOn ? '#087F23' : '#6B7280'

  return (
    <div
      className={cn(
        'flex w-full min-w-[180px] flex-col gap-1.5 rounded-[10px] border bg-white p-2',
        tripped ? 'border-status-error' : isOn ? 'border-navy' : 'border-border-subtle'
      )}
    >
      <div className="flex items-center justify-between px-1 text-xs font-semibold text-text-dark">
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-3 w-3 shrink-0 accent-navy"
            checked={selected}
            onChange={() => toggle(address)}
            aria-label={`Select CH${String(address).padStart(2, '0')} for bulk actions`}
          />
          <Radio size={13} className={isOn ? 'text-accent-blue' : 'text-text-muted-ref'} />
          <span>CH{String(address).padStart(2, '0')}</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 disabled:cursor-default"
          disabled={!tripped}
          onClick={() => tripped && resetKillSwitchOne(address)}
          title={tripped ? 'Click to reset this channel’s kill switch trip' : undefined}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor }} />
          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>
            {statusText}
          </span>
        </button>
      </div>

      {/* Fixed mode indicator - every channel is Pseudo Random Noise
          only now (direct decision, removing the Mode select + Set
          button entirely, matching the C rewrite's own card). */}
      <div
        className={cn(
          'flex h-6 items-center rounded-[7px] px-1.5 text-[10px] font-semibold',
          isOn ? 'text-accent-blue' : 'text-text-muted-ref'
        )}
      >
        {MODE_NAMES[MODE_WHITE_NOISE]}
      </div>

      <PowerButton checked={isOn} onChange={(checked) => (checked ? turnOn() : turnOff())} disabled={state.busy} />

      <div className="flex flex-col gap-0.5 pt-1">
        <LevelSlider value={level} onValueChange={handleSliderChange} disabled={!isOn} />
        <div className="flex justify-between text-[10px]">
          {([0, 1, 2, 3] as Level[]).map((lvl) => (
            <span key={lvl} className={lvl === level ? 'font-bold text-accent-blue' : 'font-normal text-text-muted-ref'}>
              {LEVEL_LABELS[lvl]}
            </span>
          ))}
        </div>
      </div>

      <div className="px-1 text-[10px] text-text-muted-ref">Up {formatUptime(liveUptime)}</div>
    </div>
  )
}
