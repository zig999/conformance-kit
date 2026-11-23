import { resolve } from 'node:path';
import { ConfigurationError } from '../shared/errors.js';
/** CNF-04: only the folder held in the tmforum directory is accepted, never a copy with the same name. */
export function assertExpectedKitDirectory(kitDirectory, expected, variable) {
    const held = resolve(expected.tmforumDirectory, expected.folder);
    if (resolve(kitDirectory) !== held) {
        throw new ConfigurationError(`${variable} must name the kit folder ${expected.folder} held in the tmforum directory`, { variable });
    }
    return held;
}
