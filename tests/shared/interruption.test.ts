import { describe, expect, it } from 'vitest';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import { listenForInterruption } from '../../src/shared/interruption.js';
import { FakeSignals } from '../support/fake-signals.js';

describe('the interruption', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)('is requested by %s and names the signal', (name) => {
    const signals = new FakeSignals();
    const interruption = listenForInterruption(signals);
    expect(interruption.signal.aborted).toBe(false);
    signals.raise(name);
    expect(interruption.signal.aborted).toBe(true);
    expect(interruption.signal.reason).toBeInstanceOf(KitDidNotRunError);
    expect(String(interruption.signal.reason)).toContain(name);
  });

  it('ignores a signal it does not listen for', () => {
    const signals = new FakeSignals();
    const interruption = listenForInterruption(signals);
    signals.raise('SIGHUP');
    expect(interruption.signal.aborted).toBe(false);
  });

  it('stops listening once it is released', () => {
    const signals = new FakeSignals();
    const interruption = listenForInterruption(signals);
    expect(signals.listenerCount()).toBe(2);
    interruption.release();
    expect(signals.listenerCount()).toBe(0);
    signals.raise('SIGINT');
    expect(interruption.signal.aborted).toBe(false);
  });
});
