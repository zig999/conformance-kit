import type { ICtkContext, KitReach } from './context.js';
import type { IModuleUnderTest } from './module-types.js';
/** Starts the module under test in the mode it declares and answers how the kit reaches it. */
export declare function startModule(ctx: ICtkContext, module: IModuleUnderTest, kitHostName: string): Promise<KitReach>;
