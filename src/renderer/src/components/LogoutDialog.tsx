import { Button } from './ui/button'

interface LogoutDialogProps {
  onTurnOffAndClose: () => void
  onKeepRunningAndClose: () => void
  onCancel: () => void
}

// Confirms before closing the app - same modal pattern as
// PortNotActivePrompt/ForceTripDialog. 3 explicit choices now, direct
// port of the C rewrite's IDD_CLOSE_CONFIRM (a plain 2-button
// Cancel/Log Out confirm before that): "Turn Off and Close" (the
// default/primary action - commands every channel off first, then
// quits - see app:turnOffAllAndQuit in main/index.ts), "Keep Running
// and Close" (this dialog's original single-choice behavior - quits
// without touching channel state, so whatever's transmitting keeps
// transmitting), "Cancel". Channel state is saved to channels.ini
// either way by the window-all-closed handler in main/index.ts -
// unconditional, not tied to which button is clicked, so it's not
// called out as a 4th choice here.
export function LogoutDialog({
  onTurnOffAndClose,
  onKeepRunningAndClose,
  onCancel
}: LogoutDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-80 rounded-lg border border-border-subtle bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-text-dark">Close the app?</p>
        <p className="mt-1 text-xs text-text-muted-ref">
          Every channel's state is saved either way. Choose what happens to them before the app closes.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            size="sm"
            className="border-status-error bg-status-error text-white hover:bg-status-error/90"
            onClick={onTurnOffAndClose}
          >
            Turn Off and Close
          </Button>
          <Button size="sm" variant="outline" onClick={onKeepRunningAndClose}>
            Keep Running and Close
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
