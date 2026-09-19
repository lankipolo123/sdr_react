import type { SensorUnitState } from '../../../main/serial/sensor'

// Continuous 4-stop cool-to-hot gradient (blue -> orange -> darker
// orange -> red), direct port of the C rewrite's vivid_thermal_color().
// A discrete band function is the wrong tool for the heatmap: 4 real
// bay readings a couple degrees apart (the normal case) usually land in
// the same band, so all 4 corners would get an identical color and the
// "scan" would collapse into one flat fill. t is 0..1 (clamped), not an
// absolute temperature - the heatmap auto-scales to the current spread
// of the live readings (see heatmapScale()) so even a 1C difference
// between bays stays visibly distinct instead of vanishing into one
// band.
const THERMAL_STOPS: [number, number, number][] = [
  [58, 133, 224],
  [224, 146, 34],
  [196, 110, 24],
  [224, 90, 90]
]

export function vividThermalColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const n = THERMAL_STOPS.length
  const scaled = clamped * (n - 1)
  let idx = Math.floor(scaled)
  if (idx >= n - 1) idx = n - 2
  const frac = scaled - idx
  const [r0, g0, b0] = THERMAL_STOPS[idx]
  const [r1, g1, b1] = THERMAL_STOPS[idx + 1]
  const r = Math.round(r0 + (r1 - r0) * frac)
  const g = Math.round(g0 + (g1 - g0) * frac)
  const b = Math.round(b0 + (b1 - b0) * frac)
  return `rgb(${r}, ${g}, ${b})`
}

export interface HeatmapScale {
  lo: number
  hi: number
}

/** Min/max across every unit with a real reading, widened to a 2C floor
 * so a near-identical set of readings doesn't collapse the whole scale
 * to a single color - same rule as the C rewrite's sensor_heatmap_subclass_proc(). */
export function heatmapScale(units: SensorUnitState[]): HeatmapScale | null {
  const readings = units.filter((u) => u.hasReading).map((u) => u.temperatureC)
  if (readings.length === 0) return null
  let lo = Math.min(...readings)
  let hi = Math.max(...readings)
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2
    lo = mid - 1
    hi = mid + 1
  }
  return { lo, hi }
}

/** Mean temperature across every unit that currently has a real
 * reading - same source the kill switch trips on (SafetyController).
 * Returns null if no unit has a reading yet. */
export function averageTemperature(units: SensorUnitState[]): number | null {
  const readings = units.filter((u) => u.hasReading)
  if (readings.length === 0) return null
  return readings.reduce((sum, u) => sum + u.temperatureC, 0) / readings.length
}
