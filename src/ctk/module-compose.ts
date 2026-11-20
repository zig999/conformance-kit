import { withoutConformanceVariables } from '../shared/environment.js';
import { KitDidNotRunError } from '../shared/errors.js';
import type { ICtkContext, KitReach } from './context.js';
import { modulesDown, modulesUp } from './docker-commands.js';
import type { IComposeModule } from './module-types.js';
import { waitUntilAnswering } from './readiness.js';
import { startStandIns } from './stand-ins.js';

const SUCCESS_EXIT_CODE = 0;

/**
 * CNF-13, mode `compose`: the stand-ins, then the service of the `kit` profile, taken down with `down` at the
 * teardown. The kit reaches the service by its name and internal port; the runner waits on CONFORMANCE_SERVICE_URL.
 */
export async function startComposeModule(ctx: ICtkContext, module: IComposeModule): Promise<KitReach> {
  const standIns = await startStandIns(ctx, module.standIns ?? []);
  const env = withoutConformanceVariables({ ...ctx.settings.environment, ...standIns });
  const { runner } = ctx.effects;
  ctx.teardown.push('the module services', async () => {
    const down = await runner.run(modulesDown(ctx.settings, module, env));
    return down.exitCode === SUCCESS_EXIT_CODE;
  });
  const up = await runner.run(modulesUp(ctx.settings, module, env));
  if (up.exitCode !== SUCCESS_EXIT_CODE) {
    throw new KitDidNotRunError(
      `starting the module services of the kit profile ended with exit status ${String(up.exitCode)}`,
    );
  }
  await waitUntilAnswering(ctx, { url: `${ctx.settings.serviceUrl}${module.apiBasePath}`, ended: () => undefined });
  return { kind: 'compose', host: module.kitHost, port: module.kitPort };
}
