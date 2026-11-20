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

  describe('a second signal', () => {
    it('tells the user, at the first one, what is going on and how to leave at once', () => {
      const signals = new FakeSignals();
      const messages: string[] = [];
      listenForInterruption(signals, (message) => messages.push(message));
      signals.raise('SIGINT');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('SIGINT');
      expect(messages[0]).toMatch(/again/);
    });

    it('is still listened for after the first, so that it can be told apart', () => {
      const signals = new FakeSignals();
      listenForInterruption(signals, () => undefined);
      signals.raise('SIGINT');
      expect(signals.listenerCount()).toBe(2);
      expect(signals.sentToSelf).toEqual([]);
    });

    it.each([
      ['SIGINT', 'SIGINT'],
      ['SIGINT', 'SIGTERM'],
      ['SIGTERM', 'SIGINT'],
    ] as const)('lets the default action of the signal happen: %s then %s', (first, second) => {
      const signals = new FakeSignals();
      const messages: string[] = [];
      listenForInterruption(signals, (message) => messages.push(message));
      signals.raise(first);
      signals.raise(second);
      expect(signals.listenerCount()).toBe(0);
      expect(signals.sentToSelf).toEqual([second]);
      expect(messages).toHaveLength(1);
    });

    it('is not taken for a second one when the run has been released in between', () => {
      const signals = new FakeSignals();
      const interruption = listenForInterruption(signals, () => undefined);
      signals.raise('SIGINT');
      interruption.release();
      signals.raise('SIGINT');
      expect(signals.sentToSelf).toEqual([]);
    });
  });
});
