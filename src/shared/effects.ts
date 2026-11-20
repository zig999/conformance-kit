import type { IClock, ICommandRunner, IFiles, IHttpProbe } from './ports.js';
import type { SpawnFunction } from './process-runner.js';

/** What the run does to the world, all of it injectable so that no test waits, spawns or touches a disk. */
export interface IRunEffects {
  readonly runner: ICommandRunner;
  readonly files: IFiles;
  readonly clock: IClock;
  readonly log: (message: string) => void;
  /** A fresh, unique, harmless identifier (it names a container). */
  readonly randomId: () => string;
  readonly temporaryDirectory: string;
  /** Starts a process that stays up (the module under test). */
  readonly spawn: SpawnFunction;
  /** Whether a port is free on all addresses of the host. */
  readonly portIsFree: (port: number) => Promise<boolean>;
  readonly probe: IHttpProbe;
}
