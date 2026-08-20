import { ChannelCard } from '../components/ChannelCard'
import { MAX_CHANNELS } from '../../../main/protocol/constants'

const CHANNELS_PER_ROW = 4 // matches main_page.py's CHANNELS_PER_ROW

export function ChannelsPage(): React.JSX.Element {
  const addresses = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1)

  return (
    <div className="flex-1 overflow-auto p-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${CHANNELS_PER_ROW}, minmax(0, 1fr))` }}
      >
        {addresses.map((address) => (
          <ChannelCard key={address} address={address} />
        ))}
      </div>
    </div>
  )
}
