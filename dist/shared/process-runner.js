import { spawn } from 'node:child_process';
const SPAWN_FAILED_EXIT_CODE = 127;
const SIGNALLED_EXIT_CODE = 130;
const KILL_SIGNAL = 'SIGKILL';
const OUTPUT_LIMIT_CHARS = 65_536;
const STDIO = ['ignore', 'pipe', 'pipe'];
const nodeSchedule = (callback, millis) => {
    const timer = setTimeout(callback, millis);
    return () => clearTimeout(timer);
};
export const nodeSpawn = (program, args, options) => spawn(program, [...args], options);
function spawnOptionsOf(command, signal) {
    return {
        env: command.env,
        stdio: STDIO,
        killSignal: KILL_SIGNAL,
        ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
        ...(command.interruptible && signal !== undefined ? { signal } : {}),
    };
}
function exitCodeOfError(error) {
    return error instanceof Error && error.name === 'AbortError' ? SIGNALLED_EXIT_CODE : SPAWN_FAILED_EXIT_CODE;
}
function watch(stream, onChunk) {
    stream?.setEncoding('utf8');
    stream?.on('data', onChunk);
}
function record(recording, chunk, fromStdout) {
    recording.output = (recording.output + chunk).slice(-OUTPUT_LIMIT_CHARS);
    if (fromStdout) {
        recording.stdout = (recording.stdout + chunk).slice(-OUTPUT_LIMIT_CHARS);
    }
}
function listen(child, recording, forward) {
    const collect = (fromStdout) => (chunk) => {
        record(recording, chunk, fromStdout);
        forward?.(chunk);
    };
    watch(child.stdout, collect(true));
    watch(child.stderr, collect(false));
}
function runCommand(options, command) {
    const start = options.spawn ?? nodeSpawn;
    const schedule = options.schedule ?? nodeSchedule;
    return new Promise((resolve) => {
        const recording = { output: '', stdout: '' };
        let timedOut = false;
        let settled = false;
        let cancelTimer = () => undefined;
        const settle = (exitCode) => {
            if (!settled) {
                settled = true;
                cancelTimer();
                resolve({ exitCode, output: recording.output, stdout: recording.stdout, timedOut });
            }
        };
        const child = start(command.program, command.args, spawnOptionsOf(command, options.signal));
        if (command.timeoutMillis !== undefined) {
            cancelTimer = schedule(() => {
                timedOut = true;
                child.kill(KILL_SIGNAL);
            }, command.timeoutMillis);
        }
        listen(child, recording, command.forwardOutput === true ? options.onOutput : undefined);
        child.on('error', (error) => settle(exitCodeOfError(error)));
        child.on('close', (code) => settle(code ?? SIGNALLED_EXIT_CODE));
    });
}
/** Runs a command to its end. The time limit is the runner's own, so that a command it killed is known as such. */
export function createProcessRunner(options = {}) {
    return { run: (command) => runCommand(options, command) };
}
