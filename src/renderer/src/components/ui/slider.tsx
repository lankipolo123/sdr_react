import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@renderer/lib/utils'

// Direct match of the reference app's LevelSlider groove backgrounds
// (components/level_slider.py in sdr_app, _GROOVE_BACKGROUNDS) - NOT a
// flat color-by-value, a fixed 4-stop gradient per level, translated
// 1:1 from Qt's qlineargradient(x1:0,y1:0,x2:0,y2:1, ...) - Qt's y:0 is
// the top of the widget and y:1 is the bottom, same as CSS
// `linear-gradient(to bottom, ...)`.
const GROOVE_BACKGROUND: Record<number, string> = {
  0: '#CBD5E1',
  1: 'linear-gradient(to bottom, #CBD5E1 0%, #CBD5E1 66.6%, #087F23 66.7%, #087F23 100%)',
  2: 'linear-gradient(to bottom, #CBD5E1 0%, #CBD5E1 33.3%, #F59E0B 33.4%, #087F23 100%)',
  3: 'linear-gradient(to bottom, #B00020 0%, #F59E0B 50%, #087F23 100%)'
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
        'relative flex touch-none select-none items-center data-[orientation=vertical]:h-[82px] data-[orientation=vertical]:w-[30px] data-[orientation=vertical]:flex-col',
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
      <SliderPrimitive.Track
        className="relative grow overflow-hidden rounded-full data-[orientation=vertical]:w-[10px]"
        style={{ background: GROOVE_BACKGROUND[value] }}
      >
        {/* No Range fill - the reference app colors the whole groove by
            level (above), it doesn't show a separate proportional fill
            on top of it. */}
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-accent-blue bg-white shadow transition-colors hover:bg-accent-blue focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  )
}
