import type { IDeviationRegister } from '../deviations/register.js';
import { type IKitItem } from './kit-report.js';
export interface IKitVerdict {
    readonly failedItems: readonly string[];
    readonly uncoveredItems: readonly string[];
    readonly passed: boolean;
}
/** CNF-15: a failed item is covered when a deviation names it; the layer passes only when none is left uncovered. */
export declare function judgeKitItems(items: readonly IKitItem[], exitCode: number, register: IDeviationRegister): IKitVerdict;
