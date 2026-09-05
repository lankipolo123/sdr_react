import { EventEmitter } from 'events'
import type { ChannelController } from './channelController'
import type { SensorState } from './serial/sensor'

// Confirmed threshold, manual-reset-only (matches the C rewrite and
// sdr_app): once tripped it stays tripped until a human explicitly
// resets it, rather than silently re-enabling the instant the reading
// dips back under the line - that would let it cycle on/off right at
// the boundary, and would make the safety trivially self-defeating
// (turn a channel back on, it trips again next reading, forever).
export const KILL_SWITCH_THRESHOLD_C = 60.0

/** Amplifier-overtemperature interlock: force every channel off the
 * moment the sensor reports >= KILL_SWITCH_THRESHOLD_C, and refuse to
 * let anything power back on until a human explicitly resets it. */
export class SafetyController extends EventEmitter {
  private _tripped = false

  constructor(private readonly channels: Map<number, ChannelController>) {
    super()
  }

  get tripped(): boolean {
    return this._tripped
  }

  onSensorState(state: SensorState): void {
    if (this._tripped) return
    if (state.hasReading && state.temperatureC >= KILL_SWITCH_THRESHOLD_C) {
      this.trip(state.temperatureC)
    }
  }

  private trip(temperatureC: number): void {
    this._tripped = true
    for (const controller of this.channels.values()) {
      controller.turnOutputOff()
    }
    this.emit('changed', true, temperatureC)
  }

  reset(): void {
    if (!this._tripped) return
    this._tripped = false
    this.emit('changed', false, null)
  }

  /** Gate for anything that would turn a channel on or raise its level -
   * OFF/level-0 is never gated, same reasoning as the C rewrite and
   * sdr_app (a safety trip must never block turning something OFF, and
   * OFF is never how you'd defeat the trip). */
  allowPowerOn(): boolean {
    return !this._tripped
  }
}
