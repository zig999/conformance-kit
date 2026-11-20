import type { IDeviationRegister } from '../deviations/register.js';
import type { IFiles } from '../shared/ports.js';
import { type LayerResult } from '../report/record.js';
export interface IPublishedComparisonInput {
    readonly pinnedOas: string;
    readonly generatedOas: () => Promise<unknown>;
}
export interface IPublishedComparisonEffects {
    readonly files: IFiles;
    readonly log: (message: string) => void;
}
export interface IPublishedComparisonOutcome {
    readonly result: LayerResult;
    /** Every difference found, covered or not; the record names the deviations that cover them. */
    readonly differences: readonly string[];
}
/** Layer 2 (CNF-02): every difference is a failure unless a deviation covers its pointer. */
export declare function runPublishedComparison(effects: IPublishedComparisonEffects, input: IPublishedComparisonInput, register: IDeviationRegister): Promise<IPublishedComparisonOutcome>;
