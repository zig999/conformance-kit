import { KitDidNotRunError } from '../shared/errors.js';
import { composeServices } from './docker-commands.js';
const SUCCESS_EXIT_CODE = 0;
/**
 * CNF-12, step 2: the runner stops only what it started, so it refuses to start when a service of the kit
 * profile from an earlier run is still up.
 */
export async function requireNothingRunning(ctx, compose) {
    const listing = await ctx.effects.runner.run(composeServices(ctx.settings, compose.directory));
    if (listing.exitCode !== SUCCESS_EXIT_CODE) {
        throw new KitDidNotRunError('the services of the kit profile that may be running cannot be listed');
    }
    if (listing.output.trim() !== '') {
        throw new KitDidNotRunError('services of the kit profile are already running, and the run stops only what it started; stop them with docker compose --profile kit down in the module directory and run again');
    }
}
