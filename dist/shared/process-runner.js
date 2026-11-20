import { spawn } from 'node:child_process';
const SPAWN_FAILED_EXIT_CODE = 127;
const SIGNALLED_EXIT_CODE = 130;
const KILL_SIGNAL = 'SIGKILL';
const OUTPUT_LIMIT_CHARS = 65_536;
const STDIO = ['ignore', 'pipe', 'pipe'];
export const nodeSpawn = (program, args, options) => spawn(program, [...args], options);
function spawnOptionsOf(command, signal) {
    return {
        env: command.env,
        stdio: STDIO,
        killSignal: KILL_SIGNAL,
        ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
        ...(command.timeoutMillis === undefined ? {} : { timeout: command.timeoutMillis }),
        ...(command.interruptible && signal !== undefined ? { signal } : {}),
    };
}
function exitCodeOfError(error) {
    return error instanceof Error && error.name === 'AbortError' ? SIGNALLED_EXIT_CODE : SPAWN_FAILED_EXIT_CODE;
}
export function createProcessRunner(options = {}) {
    const start = options.spawn ?? nodeSpawn;
    return {
        run: (command) => new Promise((resolve) => {
            let output = '';
            let settled = false;
            const settle = (exitCode) => {
                if (!settled) {
                    settled = true;
                    resolve({ exitCode, output });
                }
            };
            const child = start(command.program, command.args, spawnOptionsOf(command, options.signal));
            for (const stream of [child.stdout, child.stderr]) {
                stream?.setEncoding('utf8');
                stream?.on('data', (chunk) => {
                    output = (output + chunk).slice(-OUTPUT_LIMIT_CHARS);
                    if (command.forwardOutput === true) {
                        options.onOutput?.(chunk);
                    }
                });
            }
            child.on('error', (error) => settle(exitCodeOfError(error)));
            child.on('close', (code) => settle(code ?? SIGNALLED_EXIT_CODE));
        }),
    };
}
