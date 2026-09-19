import { EventEmitter } from 'events'
import type { ChannelController } from './channelController'

// Confirmed threshold, manual-reset-only (matches the C rewrite and
// sdr_app): once tripped it stays tripped until a human explicitly
// resets it, rather than silently re-enabling the instant the reading
// dips back under the line - that would let it cycle on/off right at
// the boundary, and would make the safety trivially self-defeating
// (turn a channel back on, it trips again next reading, forever).
export const KILL_SWITCH_THRESHOLD_C = 60.0

export interface KillSwitchState {
  trippedAddresses: number[]
}

/** Amplifier-overtemperature interlock: force every channel off the
 * moment the sensor's rack-wide average reading crosses
 * KILL_SWITCH_THRESHOLD_C - same "average across every unit that has a
 * real reading" source as the C rewrite's check_kill_switch(). Trip
 * state is tracked per channel (not one rack-wide flag): an automatic
 * or manual trip marks every channel tripped together, but each can be
 * reset independently afterward, same as the C rewrite's
 * on_unit_kill_reset(). */
export class SafetyController extends EventEmitter {
  private tripped = new Set<number>()

  constructor(private readonly channels: Map<number, ChannelController>) {
    super()
  }

  getState(): KillSwitchState {
    return { trippedAddresses: Array.from(this.tripped).sort((a, b) => a - b) }
  }

  isTripped(address: number): boolean {
    return this.tripped.has(address)
  }

  onSensorState(avgTemperatureC: number | null): void {
    if (avgTemperatureC === null || avgTemperatureC < KILL_SWITCH_THRESHOLD_C) return
    this.tripAll()
  }

  /** Manual force-trip - same rack-wide effect as an automatic overtemp
   * trip (see the C rewrite's on_kill_switch_manual_trip()), for testing
   * without needing the average to actually cross
   * KILL_SWITCH_THRESHOLD_C. */
  manualTripAll(): void {
    this.tripAll()
  }

  private tripAll(): void {
    let changed = false
    for (const [address, controller] of this.channels) {
      if (!this.tripped.has(address)) {
        this.tripped.add(address)
        controller.turnOutputOff()
        changed = true
      }
    }
    if (changed) this.emit('changed', this.getState())
  }

  resetAll(): void {
    if (this.tripped.size === 0) return
    this.tripped.clear()
    this.emit('changed', this.getState())
  }

  /** Per-unit reset - resets just this one channel, independent of the
   * others (see the C rewrite's on_unit_kill_reset()). */
  resetOne(address: number): void {
    if (!this.tripped.delete(address)) return
    this.emit('changed', this.getState())
  }

  /** Gate for anything that would turn a channel on or raise its level -
   * OFF/level-0 is never gated, same reasoning as the C rewrite and
   * sdr_app (a safety trip must never block turning something OFF, and
   * OFF is never how you'd defeat the trip). Per-channel: a channel
   * that's been individually reset can power back on even while others
   * stay tripped. */
  allowPowerOn(address: number): boolean {
    return !this.tripped.has(address)
  }
}
