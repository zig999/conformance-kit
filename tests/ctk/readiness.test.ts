import { describe, expect, it } from 'vitest';
import { waitUntilAnswering } from '../../src/ctk/readiness.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import { API_BASE_PATH, moduleWorld, type ProbeAnswer } from '../support/module-world.js';

const URL_PROBED = `http://localhost:9000${API_BASE_PATH}`;

const wait = (probe: readonly ProbeAnswer[], ended: () => string | undefined = () => undefined) => {
  const world = moduleWorld({ probe });
  const waiting = waitUntilAnswering(world.context, { url: URL_PROBED, ended });
  return { world, waiting };
};

describe('waiting for the module to answer', () => {
  it.each([200, 204, 301, 400, 401, 403, 499])('takes the status %i as ready', async (status) => {
    const { waiting, world } = wait([status]);
    await expect(waiting).resolves.toBeUndefined();
    expect(world.probed).toEqual([URL_PROBED]);
  });

  it.each([404, 500, 502, 503])('does not take the status %i as ready, and asks again', async (status) => {
    const { waiting, world } = wait([status, status, 200]);
    await expect(waiting).resolves.toBeUndefined();
    expect(world.probed).toHaveLength(3);
  });

  it('asks again when nothing answers yet', async () => {
    const { waiting, world } = wait(['down', 'down', 401]);
    await expect(waiting).resolves.toBeUndefined();
    expect(world.probed).toHaveLength(3);
  });

  it('gives up when the time for the module to answer is spent, without waiting for real', async () => {
    const { waiting, world } = wait([404]);
    await expect(waiting).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(waiting).rejects.toThrow(/did not answer/);
    expect(world.context.effects.clock.now()).toBeGreaterThanOrEqual(3333);
  });

  it('fails, pointing at the end of the module, when the module ended before it answered', async () => {
    let calls = 0;
    const { waiting } = wait(['down'], () => ((calls += 1) > 1 ? 'ended with status 1' : undefined));
    await expect(waiting).rejects.toThrow(/module ended before it answered: ended with status 1/);
  });

  it('asks with the step timeout', async () => {
    const world = moduleWorld();
    const calls: number[] = [];
    const effects = {
      ...world.context.effects,
      probe: { status: async (_u: string, timeout: number) => (calls.push(timeout), 200) },
    };
    await waitUntilAnswering({ ...world.context, effects }, { url: URL_PROBED, ended: () => undefined });
    expect(calls).toEqual([22]);
  });

  it('stops waiting when the run is interrupted', async () => {
    const world = moduleWorld({ probe: [404] });
    const controller = new AbortController();
    controller.abort();
    const waiting = waitUntilAnswering(
      { ...world.context, signal: controller.signal },
      {
        url: URL_PROBED,
        ended: () => undefined,
      },
    );
    await expect(waiting).rejects.toBeInstanceOf(KitDidNotRunError);
  });
});
