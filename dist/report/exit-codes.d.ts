export declare const EXIT_KIT_COMPLETED = 0;
export declare const EXIT_KIT_DID_NOT_RUN = 1;
export declare const EXIT_CONFIGURATION_REFUSED = 2;
export declare const EXIT_TEARDOWN_FAILED = 3;
export declare const EXIT_KIT_ITEM_FAILED = 4;
export declare const EXIT_RECORD_NOT_WRITTEN = 5;
export interface IExitFacts {
    readonly configurationRefused: boolean;
    readonly kitDidNotRun: boolean;
    readonly teardownFailed: boolean;
    readonly kitItemFailed: boolean;
    readonly recordNotWritten: boolean;
}
/** CNF-11: the first code that applies, in the order 2, 1, 3, 4, 5. */
export declare function exitCodeOf(facts: IExitFacts): number;
