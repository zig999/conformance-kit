import { spawn, type StdioOptions } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import type { ICommand, ICommandResult, ICommandRunner, Environment } from './ports.js';

const SPAWN_FAILED_EXIT_CODE = 127;
const SIGNALLED_EXIT_CODE = 130;
const KILL_SIGNAL = 'SIGKILL';
const OUTPUT_LIMIT_CHARS = 65_536;
const STDIO: StdioOptions = ['ignore', 'pipe', 'pipe'];

export interface ISpawnOptions {
  readonly cwd?: string;
  readonly env: Environment;
  readonly stdio: StdioOptions;
  readonly signal?: AbortSignal;
  readonly killSignal: NodeJS.Signals;
}

export interface IChildProcess extends EventEmitter {
  readonly stdout: Readable | null;
  readonly stderr: Readable | null;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnFunction = (program: string, args: readonly string[], options: ISpawnOptions) => IChildProcess;

/** Starts a timer and answers how to cancel it. */
export type Schedule = (callback: () => void, millis: number) => () => void;

export interface IProcessRunnerOptions {
  readonly schedule?: Schedule;
  readonly spawn?: SpawnFunction;
  readonly signal?: AbortSignal;
  readonly onOutput?: (chunk: string) => void;
}

const nodeSchedule: Schedule = (callback, millis) => {
  const timer = setTimeout(callback, millis);
  return () => clearTimeout(timer);
};

export const nodeSpawn: SpawnFunction = (program, args, options) => spawn(program, [...args], options);

function spawnOptionsOf(command: ICommand, signal: AbortSignal | undefined): ISpawnOptions {
  return {
    env: command.env,
    stdio: STDIO,
    killSignal: KILL_SIGNAL,
    ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
    ...(command.interruptible && signal !== undefined ? { signal } : {}),
  };
}

function exitCodeOfError(error: unknown): number {
  return error instanceof Error && error.name === 'AbortError' ? SIGNALLED_EXIT_CODE : SPAWN_FAILED_EXIT_CODE;
}

function watch(stream: Readable | null, onChunk: (chunk: string) => void): void {
  stream?.setEncoding('utf8');
  stream?.on('data', onChunk);
}

interface IRecording {
  output: string;
  stdout: string;
}

function record(recording: IRecording, chunk: string, fromStdout: boolean): void {
  recording.output = (recording.output + chunk).slice(-OUTPUT_LIMIT_CHARS);
  if (fromStdout) {
    recording.stdout = (recording.stdout + chunk).slice(-OUTPUT_LIMIT_CHARS);
  }
}

function listen(child: IChildProcess, recording: IRecording, forward: ((chunk: string) => void) | undefined): void {
  const collect = (fromStdout: boolean) => (chunk: string) => {
    record(recording, chunk, fromStdout);
    forward?.(chunk);
  };
  watch(child.stdout, collect(true));
  watch(child.stderr, collect(false));
}

function runCommand(options: IProcessRunnerOptions, command: ICommand): Promise<ICommandResult> {
  const start = options.spawn ?? nodeSpawn;
  const schedule = options.schedule ?? nodeSchedule;
  return new Promise<ICommandResult>((resolve) => {
    const recording: IRecording = { output: '', stdout: '' };
    let timedOut = false;
    let settled = false;
    let cancelTimer = (): void => undefined;
    const settle = (exitCode: number): void => {
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
    child.on('error', (error: unknown) => settle(exitCodeOfError(error)));
    child.on('close', (code: number | null) => settle(code ?? SIGNALLED_EXIT_CODE));
  });
}

/** Runs a command to its end. The time limit is the runner's own, so that a command it killed is known as such. */
export function createProcessRunner(options: IProcessRunnerOptions = {}): ICommandRunner {
  return { run: (command) => runCommand(options, command) };
}
