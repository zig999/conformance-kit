import type { ICtkContext, KitReach } from './context.js';
import type { IProcessModule } from './module-types.js';
/**
 * CNF-13, mode `process`: the stand-ins, then the migration, then the module on the port of the service url, listening
 * where the kit reaches it. It is stopped, with everything it started, with SIGTERM and, after the step timeout, SIGKILL. No CONFORMANCE_* variable reaches it.
 */
export declare function startProcessModule(ctx: ICtkContext, module: IProcessModule, kitHostName: string): Promise<KitReach>;
