import { withoutConformanceVariables } from '../shared/environment.js';
import { KitDidNotRunError } from '../shared/errors.js';
import { waitUntilAnswering } from './readiness.js';
import { startStandIns } from './stand-ins.js';
const LISTEN_ADDRESS = '0.0.0.0';
const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const SUCCESS_EXIT_CODE = 0;
/**
 * The module listens on the port of CONFORMANCE_SERVICE_URL. The items of the kit carry the endpoint they were
 * run against in their titles, so a port that changed at every run would change the identifier of every item
 * and no deviation could name one.
 */
async function freeServicePort(ctx) {
    const service = new URL(ctx.settings.serviceUrl);
    const fallback = service.protocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;
    const port = service.port === '' ? fallback : Number(service.port);
    if (!(await ctx.effects.portIsFree(port))) {
        throw new KitDidNotRunError(`port ${String(port)} is not free, and the module must listen on the port of CONFORMANCE_SERVICE_URL; stop what uses it or change the variable`);
    }
    return port;
}
async function applyMigration(ctx, migration, env) {
    const result = await ctx.effects.runner.run({
        program: migration.program,
        args: migration.args,
        env,
        interruptible: true,
        timeoutMillis: ctx.settings.startTimeoutMillis,
        ...(migration.cwd === undefined ? {} : { cwd: migration.cwd }),
    });
    if (result.exitCode !== SUCCESS_EXIT_CODE) {
        throw new KitDidNotRunError(`the migrations did not apply (exit status ${String(result.exitCode)})`);
    }
}
function superviseProcess(ctx, command, env) {
    const child = ctx.effects.spawn(command.program, command.args, {
        env,
        stdio: ['ignore', 'ignore', 'ignore'],
        killSignal: 'SIGKILL',
        ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
    });
    let ended;
    child.once('error', () => {
        ended ??= 'could not be started';
    });
    child.once('close', (code, signal) => {
        ended ??= code === null ? `ended with signal ${String(signal)}` : `ended with status ${String(code)}`;
    });
    return { ended: () => ended, stop: () => stopProcess(ctx, child, () => ended !== undefined) };
}
async function stopProcess(ctx, child, hasEnded) {
    if (hasEnded()) {
        return;
    }
    const closed = new Promise((resolve) => child.once('close', () => resolve()));
    child.kill('SIGTERM');
    const grace = ctx.effects.clock.sleep(ctx.settings.stepTimeoutMillis).catch(() => undefined);
    await Promise.race([closed, grace]);
    if (!hasEnded()) {
        child.kill('SIGKILL');
    }
    await closed;
}
/**
 * CNF-13, mode `process`: the stand-ins, then the migration, then the module on the port of the service url, listening
 * where the kit reaches it. It is stopped with SIGTERM and, after the step timeout, SIGKILL. No CONFORMANCE_* variable reaches it.
 */
export async function startProcessModule(ctx, module, kitHostName) {
    const port = await freeServicePort(ctx);
    const standIns = await startStandIns(ctx, module.standIns ?? []);
    const runtime = {
        listenAddress: LISTEN_ADDRESS,
        port,
        publicUrl: `http://${kitHostName}:${String(port)}`,
        standIns,
    };
    const env = withoutConformanceVariables({ ...ctx.settings.environment, ...module.environment(runtime) });
    if (module.migration !== undefined) {
        await applyMigration(ctx, module.migration, env);
    }
    const running = superviseProcess(ctx, module.start, env);
    ctx.teardown.push('the module process', running.stop);
    const service = new URL(ctx.settings.serviceUrl);
    const url = `${service.protocol}//${service.hostname}:${String(port)}${module.apiBasePath}`;
    await waitUntilAnswering(ctx, { url, ended: running.ended });
    return { kind: 'process', port };
}
