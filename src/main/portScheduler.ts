/**
 * Shared by every channel controller - the DLL exposes one global
 * connection (AutoConnectSDR/SendCommandToSDR own port access
 * internally, no port name ever passed in), so only one command is
 * ever allowed to actively be mid-send at a time. Direct port of the
 * proven pattern from the reference app's use_port_scheduler.py.
 *
 * A request made while busy just waits its turn in a plain FIFO queue -
 * no colliding calls into the DLL, nothing to block a thread on.
 */
export class PortScheduler {
  private queue: Array<{ requester: unknown; onGranted: () => void }> = []
  private holder: unknown = null

  acquire(requester: unknown, onGranted: () => void): void {
    if (this.holder === null) {
      this.holder = requester
      onGranted()
      return
    }
    this.queue.push({ requester, onGranted })
  }

  release(requester: unknown): void {
    if (this.holder !== requester) return
    this.holder = null
    this.advance()
  }

  cancel(requester: unknown): void {
    this.queue = this.queue.filter((entry) => entry.requester !== requester)
    if (this.holder === requester) {
      this.holder = null
      this.advance()
    }
  }

  private advance(): void {
    const next = this.queue.shift()
    if (next === undefined) return
    this.holder = next.requester
    next.onGranted()
  }
}
