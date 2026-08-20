import { LogsPanel } from '../components/LogsPanel'

// Dedicated full-page log view - normal in-flow layout (no absolute
// positioning, no z-index, no reserved-space math against the sidebar
// or the channels grid). Same LogsPanel content also appears compact
// on ChannelsPage; this is the full, unrestricted view of it.
export function LogsPage(): React.JSX.Element {
  return (
    <div className="p-4">
      <LogsPanel />
    </div>
  )
}
