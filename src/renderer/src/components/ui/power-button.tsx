import { cn } from '@renderer/lib/utils'

// Direct match of the reference app's PowerButton (components/power_button.py
// in sdr_app): two real, separate buttons, not one toggle - whichever is
// active gets a solid fill (green ON / red OFF), the other stays a
// transparent outlined button.
interface PowerButtonProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

const baseBtn = 'h-[22px] flex-1 rounded-[5px] text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const inactive = 'bg-transparent text-text-muted-ref border border-border-subtle'

export function PowerButton({ checked, onChange, disabled }: PowerButtonProps): React.JSX.Element {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        className={cn(baseBtn, checked ? 'bg-status-ok text-white' : inactive)}
        disabled={disabled}
        onClick={() => onChange(true)}
      >
        ON
      </button>
      <button
        type="button"
        className={cn(baseBtn, !checked ? 'bg-status-error text-white' : inactive)}
        disabled={disabled}
        onClick={() => onChange(false)}
      >
        OFF
      </button>
    </div>
  )
}
