import { KitDidNotRunError } from '../shared/errors.js';
import { dockerInfo, kitContainerRemove, kitContainers, kitRun, networkCreate, networkInspect, networkRemove, } from './docker-commands.js';
import { readKitItems } from './kit-report.js';
import { judgeKitItems } from './kit-verdict.js';
import { prepareWorkspace } from './workspace.js';
const SUCCESS_EXIT_CODE = 0;
const CONTAINER_PREFIX = 'conformance-ctk-';
/** CNF-12, step 1: without a daemon the kit does not run. */
export async function ensureDocker(ctx) {
    const result = await ctx.effects.runner.run(dockerInfo(ctx.settings));
    if (result.exitCode !== SUCCESS_EXIT_CODE) {
        throw new KitDidNotRunError('the docker daemon does not answer, so the kit did not run');
    }
}
/** CNF-12, step 3: uses the network tmf; creates it when it is not there and then removes only that one. */
export async function ensureNetwork(ctx) {
    const { runner } = ctx.effects;
    if ((await runner.run(networkInspect(ctx.settings))).exitCode === SUCCESS_EXIT_CODE) {
        return;
    }
    if ((await runner.run(networkCreate(ctx.settings))).exitCode !== SUCCESS_EXIT_CODE) {
        throw new KitDidNotRunError('the docker network of the kit could not be created');
    }
    ctx.teardown.push('the docker network of the kit', async () => {
        const removed = await runner.run(networkRemove(ctx.settings));
        return removed.exitCode === SUCCESS_EXIT_CODE;
    });
}
async function removeContainer(ctx, name) {
    const { runner } = ctx.effects;
    const listing = await runner.run(kitContainers(ctx.settings, name));
    if (listing.exitCode !== SUCCESS_EXIT_CODE) {
        return false;
    }
    return (listing.output.trim() === '' ||
        (await runner.run(kitContainerRemove(ctx.settings, name))).exitCode === SUCCESS_EXIT_CODE);
}
function judge(ctx, verdict) {
    verdict.uncoveredItems.forEach((identifier) => ctx.effects.log(`the kit reported a failed item that no deviation excludes: ${identifier}`));
    return verdict;
}
/** CNF-12, steps 4, 5 and 7, and CNF-15: runs the kit in the private copy and judges its report. */
export async function runKitContainer(ctx, reach, register) {
    const containerName = `${CONTAINER_PREFIX}${ctx.effects.randomId()}`;
    const workspace = await prepareWorkspace(ctx, reach, containerName);
    ctx.teardown.push('the kit container', () => removeContainer(ctx, containerName));
    const result = await ctx.effects.runner.run(kitRun(ctx.settings, workspace));
    ctx.effects.log(`the kit ended with exit status ${String(result.exitCode)}`);
    if (ctx.signal.aborted) {
        throw new KitDidNotRunError('the run was interrupted while the kit ran');
    }
    const items = await readKitItems(ctx.effects.files, workspace.reportsDirectory);
    return judge(ctx, judgeKitItems(items, result.exitCode, register));
}
