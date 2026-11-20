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
  /** A port that is free on all addresses of the host. */
  readonly freePort: () => Promise<number>;
  readonly probe: IHttpProbe;
}
