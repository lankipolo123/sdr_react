import { Button } from './ui/button'

interface ForceTripDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

// Same modal pattern as LogoutDialog/PortNotActivePrompt. Confirms
// before manually forcing every channel off - same rack-wide effect as
// an automatic overtemp trip (see safety.ts's manualTripAll()), direct
// port of the C rewrite's on_kill_switch_manual_trip() confirmation.
export function ForceTripDialog({ onConfirm, onCancel }: ForceTripDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-80 rounded-lg border border-border-subtle bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-text-dark">Force every channel off immediately?</p>
        <p className="mt-1 text-xs text-text-muted-ref">
          This trips the kill switch manually, same as an automatic overtemp trip - every channel stays off until
          reset.
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
            Force Trip
          </Button>
        </div>
      </div>
    </div>
  )
}
