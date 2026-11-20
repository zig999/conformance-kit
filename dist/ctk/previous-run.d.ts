import type { ICtkContext } from './context.js';
export interface IComposeDirectory {
    /** The directory of the module's compose project. */
    readonly directory: string;
}
/**
 * CNF-12, step 2: the runner stops only what it started, so it refuses to start when a service of the kit
 * profile from an earlier run is still up.
 */
export declare function requireNothingRunning(ctx: ICtkContext, compose: IComposeDirectory): Promise<void>;
