import { type StdioOptions } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import type { ICommandRunner, Environment } from './ports.js';
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
    kill(signal?: NodeJS.Signals): boolean;
}
export type SpawnFunction = (program: string, args: readonly string[], options: ISpawnOptions) => IChildProcess;
export interface IProcessRunnerOptions {
    readonly spawn?: SpawnFunction;
    readonly signal?: AbortSignal;
    readonly onOutput?: (chunk: string) => void;
}
export declare const nodeSpawn: SpawnFunction;
export declare function createProcessRunner(options?: IProcessRunnerOptions): ICommandRunner;
