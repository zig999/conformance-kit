import type { ICtkContext, KitReach } from './context.js';
import type { IComposeModule } from './module-types.js';
/**
 * CNF-13, mode `compose`: the stand-ins, then the service of the `kit` profile, taken down with `down` at the
 * teardown. The kit reaches the service by its name and internal port; the runner waits on CONFORMANCE_SERVICE_URL.
 */
export declare function startComposeModule(ctx: ICtkContext, module: IComposeModule): Promise<KitReach>;
