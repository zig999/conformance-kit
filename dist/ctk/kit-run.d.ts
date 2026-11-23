import type { IDeviationRegister } from '../deviations/register.js';
import type { ICtkContext, KitReach } from './context.js';
import { type IKitVerdict } from './kit-verdict.js';
export type IKitOutcome = IKitVerdict;
/** CNF-12, step 1: without a daemon the kit does not run. */
export declare function ensureDocker(ctx: ICtkContext): Promise<void>;
/** CNF-12, step 3: uses the network tmf; creates it when it is not there and then removes only that one. */
export declare function ensureNetwork(ctx: ICtkContext): Promise<void>;
/** CNF-12, steps 4, 5 and 7, and CNF-15: runs the kit in the private copy and judges its report. */
export declare function runKitContainer(ctx: ICtkContext, reach: KitReach, register: IDeviationRegister): Promise<IKitOutcome>;
