import { KitDidNotRunError } from '../shared/errors.js';
import type { Environment } from '../shared/ports.js';
import type { ICtkContext } from './context.js';
import { composeServices } from './docker-commands.js';

const SUCCESS_EXIT_CODE = 0;

export interface IComposeDirectory {
  /** The directory of the module's compose project. */
  readonly directory: string;
}

/**
 * CNF-12, step 2: the runner stops only what it started, so it refuses to start when a service of the kit
 * profile from an earlier run is still up. Only stdout counts: compose prints its warnings on stderr. It lists with
 * the environment `up` will get, because the compose file may need the variables the stand-ins publish.
 */
export async function requireNothingRunning(
  ctx: ICtkContext,
  compose: IComposeDirectory,
  env: Environment,
): Promise<void> {
  const listing = await ctx.effects.runner.run(composeServices(ctx.settings, compose.directory, env));
  if (listing.exitCode !== SUCCESS_EXIT_CODE) {
    throw new KitDidNotRunError('the services of the kit profile that may be running cannot be listed');
  }
  if (listing.stdout.trim() !== '') {
    throw new KitDidNotRunError(
      'services of the kit profile are already running, and the run stops only what it started; stop them with docker compose --profile kit down in the module directory and run again',
    );
  }
}
