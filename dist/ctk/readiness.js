import { KitDidNotRunError } from '../shared/errors.js';
const POLL_INTERVAL_MS = 500;
const HTTP_NOT_FOUND = 404;
const FIRST_SERVER_ERROR_STATUS = 500;
function assertNotInterrupted(ctx) {
    if (ctx.signal.aborted) {
        throw new KitDidNotRunError('the run was interrupted while it waited for the module');
    }
}
async function answers(ctx, url) {
    try {
        const status = await ctx.effects.probe.status(url, ctx.settings.stepTimeoutMillis, ctx.signal);
        return status !== HTTP_NOT_FOUND && status < FIRST_SERVER_ERROR_STATUS;
    }
    catch {
        return false;
    }
}
async function pause(ctx) {
    try {
        await ctx.effects.clock.sleep(POLL_INTERVAL_MS, ctx.signal);
    }
    catch (error) {
        assertNotInterrupted(ctx);
        throw error;
    }
}
/**
 * CNF-13, "pronto": the base path of the API answers with a status other than 404 and below 500, within
 * CONFORMANCE_START_TIMEOUT_MS. A module that ends before it answers fails the run, pointing at its end.
 */
export async function waitUntilAnswering(ctx, target) {
    const deadline = ctx.effects.clock.now() + ctx.settings.startTimeoutMillis;
    while (ctx.effects.clock.now() < deadline) {
        assertNotInterrupted(ctx);
        const ended = target.ended();
        if (ended !== undefined) {
            throw new KitDidNotRunError(`the module ended before it answered: ${ended}`);
        }
        if (await answers(ctx, target.url)) {
            return;
        }
        await pause(ctx);
    }
    throw new KitDidNotRunError(`the module did not answer within ${String(ctx.settings.startTimeoutMillis)} ms (CONFORMANCE_START_TIMEOUT_MS)`);
}
