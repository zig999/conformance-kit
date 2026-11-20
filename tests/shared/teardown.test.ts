import { describe, expect, it } from 'vitest';
import { Teardown } from '../../src/shared/teardown.js';

describe('the teardown', () => {
  it('stops what was started in the reverse order', async () => {
    const order: string[] = [];
    const teardown = new Teardown((message) => order.push(`log: ${message}`));
    teardown.push('the network', async () => void order.push('network'));
    teardown.push('the module', async () => void order.push('module'));
    teardown.push('the container', async () => void order.push('container'));
    expect(await teardown.run()).toBe(0);
    expect(order).toEqual(['container', 'module', 'network']);
  });

  it('goes on after a step that throws, logs it and counts it', async () => {
    const stopped: string[] = [];
    const log: string[] = [];
    const teardown = new Teardown((message) => log.push(message));
    teardown.push('the first', async () => void stopped.push('first'));
    teardown.push('the second', async () => {
      throw new Error('the daemon went away');
    });
    teardown.push('the third', async () => void stopped.push('third'));
    expect(await teardown.run()).toBe(1);
    expect(stopped).toEqual(['third', 'first']);
    expect(log.join('\n')).toContain('the second');
    expect(log.join('\n')).toContain('the daemon went away');
  });

  it('counts a step that reports it could not stop what it started', async () => {
    const teardown = new Teardown(() => undefined);
    teardown.push('the container', async () => false);
    teardown.push('the network', async () => true);
    expect(await teardown.run()).toBe(1);
  });

  it('counts every failed step', async () => {
    const teardown = new Teardown(() => undefined);
    teardown.push('a', async () => false);
    teardown.push('b', async () => false);
    expect(await teardown.run()).toBe(2);
  });

  it('runs a step once, even when it is asked to run again', async () => {
    let times = 0;
    const teardown = new Teardown(() => undefined);
    teardown.push('a', async () => void (times += 1));
    await teardown.run();
    await teardown.run();
    expect(times).toBe(1);
  });

  it('has nothing to do, and no failure, when nothing was started', async () => {
    expect(await new Teardown(() => undefined).run()).toBe(0);
  });
});
