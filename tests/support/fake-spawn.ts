import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IChildProcess, ISpawnOptions } from '../../src/shared/process-runner.js';

export interface ISpawned {
  readonly program: string;
  readonly args: readonly string[];
  readonly options: ISpawnOptions;
  readonly child: FakeChild;
}

export class FakeChild extends EventEmitter implements IChildProcess {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly signals: string[] = [];
  /** The signals that make this child exit. By default both SIGTERM and SIGKILL do. */
  exitsOn = new Set<string>(['SIGTERM', 'SIGKILL']);

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.signals.push(signal);
    if (this.exitsOn.has(signal)) {
      this.finish(null, signal);
    }
    return true;
  }

  finish(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.stdout.end();
    this.stderr.end();
    this.emit('close', code, signal);
  }

  failToStart(code: string): void {
    this.emit('error', Object.assign(new Error(`spawn failed: ${code}`), { code }));
    this.emit('close', -2, null);
  }
}

export interface IFakeSpawn {
  readonly spawned: ISpawned[];
  readonly spawn: (program: string, args: readonly string[], options: ISpawnOptions) => IChildProcess;
}

export function createFakeSpawn(onSpawn: (spawned: ISpawned) => void): IFakeSpawn {
  const spawned: ISpawned[] = [];
  return {
    spawned,
    spawn: (program, args, options) => {
      const child = new FakeChild();
      const entry = { program, args, options, child };
      spawned.push(entry);
      options.signal?.addEventListener('abort', () => {
        child.emit('error', Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        child.finish(null, 'SIGTERM');
      });
      queueMicrotask(() => onSpawn(entry));
      return child;
    },
  };
}
