import type { Environment } from '../shared/ports.js';
import type { ICtkContext } from './context.js';
export interface IComposeDirectory {
    /** The directory of the module's compose project. */
    readonly directory: string;
}
/**
 * CNF-12, step 2: the runner stops only what it started, so it refuses to start when a service of the kit
 * profile from an earlier run is still up. Only stdout counts: compose prints its warnings on stderr. It lists with
 * the environment `up` will get, because the compose file may need the variables the stand-ins publish.
 */
export declare function requireNothingRunning(ctx: ICtkContext, compose: IComposeDirectory, env: Environment): Promise<void>;
