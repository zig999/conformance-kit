import type { IClock } from '../../src/shared/ports.js';

/** A clock that never waits: sleeping moves the time forward and resolves at once. */
export class FakeClock implements IClock {
  private current: number;
  readonly sleeps: number[] = [];

  constructor(start = 0) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  async sleep(millis: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    this.sleeps.push(millis);
    this.current += millis;
  }
}
