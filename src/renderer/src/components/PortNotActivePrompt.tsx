import { Button } from './ui/button'

interface PortNotActivePromptProps {
  onConnect: () => void
  onDismiss: () => void
}

// Shown when a channel control is used before the port's been
// activated - so a click doesn't just silently do nothing (or fire a
// send into a dead DLL connection) with no feedback.
export function PortNotActivePrompt({ onConnect, onDismiss }: PortNotActivePromptProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onDismiss}>
      <div
        className="w-72 rounded-lg border border-border-subtle bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-text-dark">Port not active</p>
        <p className="mt-1 text-xs text-text-muted-ref">
          Please activate the port before sending a command to a channel.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="border-status-ok bg-status-ok text-white hover:bg-status-ok/90"
            onClick={onConnect}
          >
            Connect
          </Button>
        </div>
      </div>
    </div>
  )
}
