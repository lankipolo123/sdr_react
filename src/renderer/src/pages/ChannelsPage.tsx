import { ChannelCard } from '../components/ChannelCard'
import { MAX_CHANNELS } from '../../../main/protocol/constants'

// Auto-fill instead of a hardcoded column count (the reference app's
// CHANNELS_PER_ROW=4 is fixed regardless of window size) - column
// count now adapts to however much width is actually available, down
// to one card's minimum width before wrapping.
const CARD_MIN_WIDTH = 180

export function ChannelsPage(): React.JSX.Element {
  const addresses = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1)

  return (
    <div className="p-4 pb-0">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))` }}
      >
        {addresses.map((address) => (
          <ChannelCard key={address} address={address} />
        ))}
      </div>
    </div>
  )
}
