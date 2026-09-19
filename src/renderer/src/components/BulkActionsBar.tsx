import { useState } from 'react'
import { Button } from './ui/button'
import { useConnection } from '../contexts/ConnectionContext'
import { useSensor } from '../contexts/SensorContext'
import { useSelection } from '../contexts/SelectionContext'
import { LEVEL_LABELS, MAX_CHANNELS, MODE_NAMES, type Level } from '../../../main/protocol/constants'

const ALL_ADDRESSES = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1)

// Direct port of the C rewrite's Bulk Actions bar: check a card's
// checkbox to select it (see ChannelCard/SelectionContext), then apply
// ON/OFF/Set-mode/Set-level to every selected channel at once. Loops
// the same per-channel IPC calls a single card already uses - no new
// main-process surface needed, this is purely a renderer-side
// convenience over the existing channel:* API.
export function BulkActionsBar(): React.JSX.Element {
  const { selected, selectAll, clear } = useSelection()
  const { requireConnected } = useConnection()
  const { isChannelTripped } = useSensor()
  const [bulkMode, setBulkMode] = useState<number>(0)

  const count = selected.size

  // Same rule as a single card's turnOn/setLevel (see useChannel.ts):
  // bail out to the "activate the port" prompt instead of firing into a
  // dead connection, once for the whole batch rather than per channel.
  function forEachSelected(cb: (address: number) => void): void {
    if (!requireConnected()) return
    for (const address of selected) cb(address)
  }

  function bulkOn(): void {
    // Tripped channels are skipped for ON, same as the C rewrite's Bulk
    // ON (`g_channel_selected[i] && !g_kill_switch_tripped[i]`) - OFF
    // and Set are never gated by a trip.
    forEachSelected((address) => {
      if (!isChannelTripped(address)) void window.sdr.channels.turnOn(address)
    })
  }

  function bulkOff(): void {
    forEachSelected((address) => void window.sdr.channels.turnOff(address))
  }

  function bulkSetLevel(level: Level): void {
    forEachSelected((address) => {
      if (level === 0 || !isChannelTripped(address)) void window.sdr.channels.setLevel(address, level)
    })
  }

  function bulkSetMode(): void {
    forEachSelected((address) => void window.sdr.channels.setMode(address, bulkMode))
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-border-subtle bg-white p-2.5">
      <span className="text-xs font-semibold text-text-dark">
        Bulk Actions{count > 0 ? ` (${count} selected)` : ''}
      </span>

      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => selectAll(ALL_ADDRESSES)}>
        Select All
      </Button>
      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={clear} disabled={count === 0}>
        Clear
      </Button>

      <div className="mx-1 h-4 w-px bg-border-subtle" />

      <Button
        size="sm"
        variant="outline"
        className="h-6 border-status-ok bg-status-ok px-2 text-[10px] text-white hover:bg-status-ok/90"
        onClick={bulkOn}
        disabled={count === 0}
      >
        Bulk ON
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 border-status-error bg-status-error px-2 text-[10px] text-white hover:bg-status-error/90"
        onClick={bulkOff}
        disabled={count === 0}
      >
        Bulk OFF
      </Button>

      <div className="mx-1 h-4 w-px bg-border-subtle" />

      <span className="text-[10px] text-text-muted-ref">Level:</span>
      {([0, 1, 2, 3] as Level[]).map((lvl) => (
        <Button
          key={lvl}
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px]"
          onClick={() => bulkSetLevel(lvl)}
          disabled={count === 0}
        >
          {LEVEL_LABELS[lvl]}
        </Button>
      ))}

      <div className="mx-1 h-4 w-px bg-border-subtle" />

      <select
        className="h-6 min-w-0 rounded-[7px] border border-border-subtle bg-white px-1.5 text-[10px] font-semibold text-text-dark"
        value={bulkMode}
        onChange={(e) => setBulkMode(Number(e.target.value))}
      >
        {Object.entries(MODE_NAMES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        className="h-6 bg-navy px-2 text-[10px] text-white hover:bg-navy/90"
        onClick={bulkSetMode}
        disabled={count === 0}
      >
        Set Mode
      </Button>
    </div>
  )
}
