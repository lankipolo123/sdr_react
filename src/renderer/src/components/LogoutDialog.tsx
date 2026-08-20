import { Button } from './ui/button'

interface LogoutDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

// Confirms before disconnecting the port and closing the whole app -
// same modal pattern as PortNotActivePrompt.
export function LogoutDialog({ onConfirm, onCancel }: LogoutDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-72 rounded-lg border border-border-subtle bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-text-dark">Log out?</p>
        <p className="mt-1 text-xs text-text-muted-ref">
          This disconnects the port and closes the app completely.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="border-status-error bg-status-error text-white hover:bg-status-error/90"
            onClick={onConfirm}
          >
            Log Out
          </Button>
        </div>
      </div>
    </div>
  )
}
