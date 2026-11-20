import type { ICtkContext } from './context.js';
import type { IStandIn } from './module-types.js';
/** Starts the stand-ins in order, each one closed at the teardown, after what depends on it. Answers their variables. */
export declare function startStandIns(ctx: ICtkContext, standIns: readonly IStandIn[]): Promise<Readonly<Record<string, string>>>;
