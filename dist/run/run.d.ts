import type { IRunEffects } from '../shared/effects.js';
import type { IConformanceRun } from './types.js';
/**
 * Runs the four layers of one API, then records the result and answers the exit code of CNF-11. The layers
 * before the kit run one after another and a failure does not stop the next. An API with no kit has no layer 4.
 * Everything the run says goes through the redactor, so the token never appears in a message.
 */
export declare function runWith(effects: IRunEffects, run: IConformanceRun, signal: AbortSignal): Promise<number>;
