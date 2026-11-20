import type { ICtkContext } from './context.js';
export interface IReadinessTarget {
    /** The base path of the API, as the machine that runs the command reaches it. */
    readonly url: string;
    /** Says why the module ended, or nothing while it is up. */
    readonly ended: () => string | undefined;
}
/**
 * CNF-13, "pronto": the base path of the API answers with a status other than 404 and below 500, within
 * CONFORMANCE_START_TIMEOUT_MS. A module that ends before it answers fails the run, pointing at its end.
 */
export declare function waitUntilAnswering(ctx: ICtkContext, target: IReadinessTarget): Promise<void>;
