import { resolve } from 'node:path';
import { ConfigurationError } from '../shared/errors.js';

export interface IExpectedKit {
  /** The `tmforum` directory that holds the official kits. */
  readonly tmforumDirectory: string;
  /** The name of the folder of the kit in it, such as `tmf637-v5.0.0-ctk-1.0.1`. */
  readonly folder: string;
}

/** CNF-04: only the folder held in the tmforum directory is accepted, never a copy with the same name. */
export function assertExpectedKitDirectory(kitDirectory: string, expected: IExpectedKit, variable: string): string {
  const held = resolve(expected.tmforumDirectory, expected.folder);
  if (resolve(kitDirectory) !== held) {
    throw new ConfigurationError(
      `${variable} must name the kit folder ${expected.folder} held in the tmforum directory`,
      { variable },
    );
  }
  return held;
}
