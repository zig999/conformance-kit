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
  readonly timeout?: number;
  readonly killSignal: NodeJS.Signals;
}

export interface IChildProcess extends EventEmitter {
  readonly stdout: Readable | null;
  readonly stderr: Readable | null;
}

export type SpawnFunction = (program: string, args: readonly string[], options: ISpawnOptions) => IChildProcess;

export interface IProcessRunnerOptions {
  readonly spawn?: SpawnFunction;
  readonly signal?: AbortSignal;
  readonly onOutput?: (chunk: string) => void;
}

const nodeSpawn: SpawnFunction = (program, args, options) => spawn(program, [...args], options);

function spawnOptionsOf(command: ICommand, signal: AbortSignal | undefined): ISpawnOptions {
  return {
    env: command.env,
    stdio: STDIO,
    killSignal: KILL_SIGNAL,
    ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
    ...(command.timeoutMillis === undefined ? {} : { timeout: command.timeoutMillis }),
    ...(command.interruptible && signal !== undefined ? { signal } : {}),
  };
}

function exitCodeOfError(error: unknown): number {
  return error instanceof Error && error.name === 'AbortError' ? SIGNALLED_EXIT_CODE : SPAWN_FAILED_EXIT_CODE;
}

export function createProcessRunner(options: IProcessRunnerOptions = {}): ICommandRunner {
  const start = options.spawn ?? nodeSpawn;
  return {
    run: (command) =>
      new Promise<ICommandResult>((resolve) => {
        let output = '';
        let settled = false;
        const settle = (exitCode: number): void => {
          if (!settled) {
            settled = true;
            resolve({ exitCode, output });
          }
        };
        const child = start(command.program, command.args, spawnOptionsOf(command, options.signal));
        for (const stream of [child.stdout, child.stderr]) {
          stream?.setEncoding('utf8');
          stream?.on('data', (chunk: string) => {
            output = (output + chunk).slice(-OUTPUT_LIMIT_CHARS);
            options.onOutput?.(chunk);
          });
        }
        child.on('error', (error: unknown) => settle(exitCodeOfError(error)));
        child.on('close', (code: number | null) => settle(code ?? SIGNALLED_EXIT_CODE));
      }),
  };
}
