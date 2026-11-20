import { KitDidNotRunError } from '../shared/errors.js';
import type { ICtkContext } from './context.js';
import type { IStandIn } from './module-types.js';

/** Starts the stand-ins in order, each one closed at the teardown, after what depends on it. Answers their variables. */
export async function startStandIns(
  ctx: ICtkContext,
  standIns: readonly IStandIn[],
): Promise<Readonly<Record<string, string>>> {
  const published: Record<string, string> = {};
  for (const [position, standIn] of standIns.entries()) {
    try {
      const handle = await standIn.start();
      ctx.teardown.push(`stand-in ${String(position + 1)}`, () => handle.close());
      Object.assign(published, handle.environment);
    } catch (cause) {
      throw new KitDidNotRunError(`stand-in ${String(position + 1)} did not start`, {}, { cause });
    }
  }
  return published;
}
