import { KitDidNotRunError } from '../shared/errors.js';
/** Starts the stand-ins in order, each one closed at the teardown, after what depends on it. Answers their variables. */
export async function startStandIns(ctx, standIns) {
    const published = {};
    for (const [position, standIn] of standIns.entries()) {
        try {
            const handle = await standIn.start();
            ctx.teardown.push(`stand-in ${String(position + 1)}`, () => handle.close());
            Object.assign(published, handle.environment);
        }
        catch (cause) {
            throw new KitDidNotRunError(`stand-in ${String(position + 1)} did not start`, {}, { cause });
        }
    }
    return published;
}
