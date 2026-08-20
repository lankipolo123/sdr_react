import { ChannelCard } from '../components/ChannelCard'
import { LogsPanel } from '../components/LogsPanel'
import { MAX_CHANNELS } from '../../../main/protocol/constants'

// Auto-fill instead of a hardcoded column count (the reference app's
// CHANNELS_PER_ROW=4 is fixed regardless of window size) - column
// count now adapts to however much width is actually available, down
// to one card's minimum width before wrapping.
const CARD_MIN_WIDTH = 180

export function ChannelsPage(): React.JSX.Element {
  const addresses = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1)

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))` }}
      >
        {addresses.map((address) => (
          <ChannelCard key={address} address={address} />
        ))}
      </div>

      {/* Compact logs, visible right here on the main page too - full
          LogsPanel lives on its own dedicated Logs page (see the
          sidebar), this is just a normal in-flow section, not an
          overlay, so it can't reintroduce the padding/z-index/space
          issues the floating version kept running into. */}
      <div className="mt-4 max-h-40 overflow-y-auto rounded-md border border-border-subtle">
        <LogsPanel />
      </div>
    </div>
  )
}
