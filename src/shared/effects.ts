import type { IClock, ICommandRunner, IFiles } from './ports.js';

/** What the run does to the world, all of it injectable so that no test waits, spawns or touches a disk. */
export interface IRunEffects {
  readonly runner: ICommandRunner;
  readonly files: IFiles;
  readonly clock: IClock;
  readonly log: (message: string) => void;
  /** A fresh, unique, harmless identifier (it names a container). */
  readonly randomId: () => string;
  readonly temporaryDirectory: string;
}
