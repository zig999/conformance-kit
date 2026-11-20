import type { IChildProcess } from './process-runner.js';
export interface IProcessControl {
    /** Signals the child and everything it started: the module is often launched through a wrapper such as `pnpm start`. */
    signal(child: IChildProcess, name: NodeJS.Signals): void;
    /** Whether the child, or anything of its group, is still running. */
    isAlive(child: IChildProcess): boolean;
}
export type Kill = (pid: number, signal: NodeJS.Signals | 0) => void;
/**
 * The module is started as the leader of its own process group, so that a negative pid reaches the wrapper and the
 * server behind it. Without that, SIGTERM and SIGKILL stop the wrapper and the server keeps its port.
 */
export declare function createProcessControl(kill?: Kill): IProcessControl;
