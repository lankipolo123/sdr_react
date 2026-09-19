import { Radio } from 'lucide-react'
import type { SensorUnitState } from '../../../main/serial/sensor'
import { heatmapScale, vividThermalColor } from '../lib/sensor'

interface SensorHeatmapProps {
  units: SensorUnitState[]
}

const MUTED_COLOR = '#9CA3AF'

// BAY 1 top-left, BAY 2 top-right, BAY 3 bottom-left, BAY 4 bottom-right
// - same corner layout as the C rewrite's sensor_heatmap_subclass_proc().
const CORNER_POSITION = ['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2']
const GRADIENT_POSITION = ['0% 0%', '100% 0%', '0% 100%', '100% 100%']

// CSS approximation of the C rewrite's per-bay concentric alpha-blended
// radial "heat origin" blobs (GDI has no native radial gradient, so it
// fakes one with layered circles) - a radial-gradient layer centered on
// each corner, fading to transparent, does the same job natively here.
export function SensorHeatmap({ units }: SensorHeatmapProps): React.JSX.Element {
  const scale = heatmapScale(units)
  const colors = units.map((u) =>
    u.hasReading && scale ? vividThermalColor((u.temperatureC - scale.lo) / (scale.hi - scale.lo)) : MUTED_COLOR
  )

  const backgroundImage = colors
    .map((color, i) => `radial-gradient(circle at ${GRADIENT_POSITION[i]}, ${color}66 0%, ${color}00 65%)`)
    .join(', ')

  return (
    <div className="mt-2">
      <div
        className="relative h-40 w-full overflow-hidden rounded-lg border border-border-subtle"
        style={{ background: '#F3F4F6' }}
      >
        <div className="absolute inset-0" style={{ backgroundImage }} />

        {/* Faded emblem watermark, centered - same idiom the C rewrite
            uses for its idle signal-wave area and this heatmap panel
            (draw_app_logo_faded()), direct request to put one here too. */}
        <Radio
          size={72}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-navy opacity-10"
        />

        {units.map((unit, i) => (
          <div key={unit.address} className={`absolute ${CORNER_POSITION[i]} text-right`}>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-text-muted-ref">
              BAY {unit.address}
            </div>
            <div className="text-xs font-bold" style={{ color: colors[i] }}>
              {unit.hasReading ? `${unit.temperatureC.toFixed(1)}°C` : unit.online ? 'Reading…' : '-'}
            </div>
          </div>
        ))}
      </div>

      {/* Legend: colors are auto-scaled to the CURRENT spread of
          readings, not a fixed scale - a color alone no longer tells you
          an absolute temperature, so spell out what the current lo/hi
          actually is. */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] text-text-muted-ref">{scale ? `${scale.lo.toFixed(1)}°C` : '-'}</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${vividThermalColor(0)}, ${vividThermalColor(1 / 3)}, ${vividThermalColor(2 / 3)}, ${vividThermalColor(1)})`
          }}
        />
        <span className="text-[10px] text-text-muted-ref">{scale ? `${scale.hi.toFixed(1)}°C` : '-'}</span>
      </div>
    </div>
  )
}
