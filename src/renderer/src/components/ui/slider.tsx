import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@renderer/lib/utils'

// Colored by value (green -> orange -> red as level rises), matching
// the reference app's LevelSlider exactly (see rewrite guide section 6).
const LEVEL_TRACK_COLOR: Record<number, string> = {
  0: 'bg-muted-foreground/40',
  1: 'bg-green-500',
  2: 'bg-orange-500',
  3: 'bg-red-500'
}

interface LevelSliderProps {
  value: number
  onValueChange: (value: number) => void
  disabled?: boolean
  className?: string
}

export function LevelSlider({ value, onValueChange, disabled, className }: LevelSliderProps): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex touch-none select-none items-center data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-5 data-[orientation=vertical]:flex-col',
        className
      )}
      orientation="vertical"
      min={0}
      max={3}
      step={1}
      value={[value]}
      disabled={disabled}
      onValueChange={([v]) => onValueChange(v)}
    >
      <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:w-1.5">
        <SliderPrimitive.Range
          className={cn('absolute data-[orientation=vertical]:w-full', LEVEL_TRACK_COLOR[value])}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block h-4 w-4 rounded-full border-2 border-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          LEVEL_TRACK_COLOR[value]
        )}
      />
    </SliderPrimitive.Root>
  )
}
