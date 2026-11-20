import type { IDeviationRegister } from './register.js';
export interface IAppliedFacts {
    readonly failedItems: readonly string[];
    readonly differences: readonly string[];
}
/** The deviation nodes that covered a difference or excluded an item in this run, without repetition (CNF-07). */
export declare function deviationsApplied(register: IDeviationRegister | undefined, facts: IAppliedFacts): string[];
