import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@renderer/lib/utils'

// Horizontal version of the reference app's LevelSlider groove
// backgrounds (components/level_slider.py in sdr_app,
// _GROOVE_BACKGROUNDS). The original is vertical with max at the top -
// translated here to horizontal with max at the right (the standard
// orientation for a horizontal slider), preserving the actual meaning:
// red/danger always sits at the "toward max power" end, wherever the
// handle currently is - not just top vs. bottom swapped for its own
// sake. Not a flat color-by-value - a fixed 4-stop gradient per level.
const GROOVE_BACKGROUND: Record<number, string> = {
  0: '#CBD5E1',
  1: 'linear-gradient(to right, #087F23 0%, #087F23 33.3%, #CBD5E1 33.4%, #CBD5E1 100%)',
  2: 'linear-gradient(to right, #087F23 0%, #F59E0B 66.6%, #CBD5E1 66.7%, #CBD5E1 100%)',
  3: 'linear-gradient(to right, #087F23 0%, #F59E0B 50%, #B00020 100%)'
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
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      orientation="horizontal"
      min={0}
      max={3}
      step={1}
      value={[value]}
      disabled={disabled}
      onValueChange={([v]) => onValueChange(v)}
    >
      <SliderPrimitive.Track
        className="relative h-[10px] grow overflow-hidden rounded-full"
        style={{ background: GROOVE_BACKGROUND[value] }}
      >
        {/* No Range fill - the reference app colors the whole groove by
            level (above), it doesn't show a separate proportional fill
            on top of it. */}
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 shrink-0 rounded-full border-2 border-accent-blue bg-white shadow transition-colors hover:bg-accent-blue focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  )
}
