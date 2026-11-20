import type { IChildProcess } from './process-runner.js';

const GROUP_GONE = 'ESRCH';
const NOT_PERMITTED = 'EPERM';
const NO_SIGNAL = 0;

export interface IProcessControl {
  /** Signals the child and everything it started: the module is often launched through a wrapper such as `pnpm start`. */
  signal(child: IChildProcess, name: NodeJS.Signals): void;
  /** Whether the child, or anything of its group, is still running. */
  isAlive(child: IChildProcess): boolean;
}

export type Kill = (pid: number, signal: NodeJS.Signals | 0) => void;

const nodeKill: Kill = (pid, signal) => void process.kill(pid, signal);

function codeOf(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined;
}

function signalGroup(kill: Kill, child: IChildProcess, name: NodeJS.Signals): void {
  if (child.pid === undefined) {
    child.kill(name);
    return;
  }
  try {
    kill(-child.pid, name);
  } catch (error) {
    if (codeOf(error) !== GROUP_GONE) {
      throw error;
    }
  }
}

function groupIsAlive(kill: Kill, child: IChildProcess): boolean {
  if (child.pid === undefined) {
    return false;
  }
  try {
    kill(-child.pid, NO_SIGNAL);
    return true;
  } catch (error) {
    const code = codeOf(error);
    if (code !== GROUP_GONE && code !== NOT_PERMITTED) {
      throw error;
    }
    return code === NOT_PERMITTED;
  }
}

/**
 * The module is started as the leader of its own process group, so that a negative pid reaches the wrapper and the
 * server behind it. Without that, SIGTERM and SIGKILL stop the wrapper and the server keeps its port.
 */
export function createProcessControl(kill: Kill = nodeKill): IProcessControl {
  return {
    signal: (child, name) => signalGroup(kill, child, name),
    isAlive: (child) => groupIsAlive(kill, child),
  };
}
