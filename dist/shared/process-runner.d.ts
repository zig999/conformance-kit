import { type StdioOptions } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import type { ICommandRunner, Environment } from './ports.js';
export interface ISpawnOptions {
    readonly cwd?: string;
    readonly env: Environment;
    readonly stdio: StdioOptions;
    readonly signal?: AbortSignal;
    /** Makes the child the leader of a new process group, so that its descendants can be signalled with it. */
    readonly detached?: boolean;
    readonly killSignal: NodeJS.Signals;
}
export interface IChildProcess extends EventEmitter {
    readonly pid?: number | undefined;
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
export declare const nodeSpawn: SpawnFunction;
/** Runs a command to its end. The time limit is the runner's own, so that a command it killed is known as such. */
export declare function createProcessRunner(options?: IProcessRunnerOptions): ICommandRunner;
