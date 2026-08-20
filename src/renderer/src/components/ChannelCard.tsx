import { useEffect, useRef, useState } from 'react'
import { PowerButton } from './ui/power-button'
import { LevelSlider } from './ui/slider'
import { cn } from '../lib/utils'
import { useChannel } from '../hooks/useChannel'
import { LEVEL_LABELS, MODE_NAMES, type Level } from '../../../main/protocol/constants'

// Matches components/level_slider.py's SLIDER_SEND_DEBOUNCE_MS - avoids
// firing a DLL send on every intermediate value while dragging.
const SLIDER_SEND_DEBOUNCE_MS = 250

interface ChannelCardProps {
  address: number
}

export function ChannelCard({ address }: ChannelCardProps): React.JSX.Element {
  const { state, turnOn, turnOff, setLevel, setMode } = useChannel(address)

  // Mode selection is local/uncommitted until "Set" is clicked - matches
  // the reference app's mode_combo + mode_set_btn exactly (selecting a
  // mode does NOT apply it by itself).
  const [selectedMode, setSelectedMode] = useState<number>(0)
  useEffect(() => {
    if (state !== null) setSelectedMode(state.mode)
  }, [state?.mode])

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

  const isOn = state.outputOn
  const level = state.level
  const statusText = state.busy ? 'SENDING…' : isOn ? LEVEL_LABELS[level].toUpperCase() : 'STANDBY'
  const statusColor = state.busy ? '#64AAFF' : isOn ? '#087F23' : '#6B7280'

  return (
    <div
      className={cn(
        'flex w-full min-w-[180px] flex-col gap-1.5 rounded-[10px] border bg-white p-2',
        isOn ? 'border-accent-blue' : 'border-border-subtle'
      )}
    >
      <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-text-dark">
        <span>CH{String(address).padStart(2, '0')}</span>
      </div>

      <div className="flex items-center gap-1">
        <select
          className={cn(
            'h-6 min-w-0 flex-1 rounded-[7px] border border-border-subtle bg-white px-1.5 text-[10px] font-semibold',
            isOn ? 'text-accent-blue' : 'text-text-muted-ref'
          )}
          value={selectedMode}
          onChange={(e) => setSelectedMode(Number(e.target.value))}
        >
          {Object.entries(MODE_NAMES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="h-6 shrink-0 rounded-[7px] bg-navy px-1.5 text-[10px] font-semibold text-accent-blue"
          onClick={() => setMode(selectedMode)}
        >
          Set
        </button>
      </div>

      <PowerButton checked={isOn} onChange={(checked) => (checked ? turnOn() : turnOff())} disabled={state.busy} />

      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor }} />
        <span className="text-xs font-semibold" style={{ color: statusColor }}>
          {statusText}
        </span>
      </div>

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

      {/* The actual bytes sent for the last command - not part of the
          reference app's per-card UI (it uses a separate global Logs
          panel), added per request. */}
      <div
        className="truncate rounded-[6px] bg-border-subtle/40 px-1.5 py-1 font-mono text-[9px] text-text-muted-ref"
        title={state.lastFrameHex}
      >
        TX: {state.lastFrameHex}
        {state.lastCommandUnconfirmed && ' (unconfirmed)'}
      </div>
    </div>
  )
}
