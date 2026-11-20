export const EXIT_KIT_COMPLETED = 0;
export const EXIT_KIT_DID_NOT_RUN = 1;
export const EXIT_CONFIGURATION_REFUSED = 2;
export const EXIT_TEARDOWN_FAILED = 3;
export const EXIT_KIT_ITEM_FAILED = 4;
export const EXIT_RECORD_NOT_WRITTEN = 5;
/** CNF-11: the first code that applies, in the order 2, 1, 3, 4, 5. */
export function exitCodeOf(facts) {
    if (facts.configurationRefused) {
        return EXIT_CONFIGURATION_REFUSED;
    }
    if (facts.kitDidNotRun) {
        return EXIT_KIT_DID_NOT_RUN;
    }
    if (facts.teardownFailed) {
        return EXIT_TEARDOWN_FAILED;
    }
    if (facts.kitItemFailed) {
        return EXIT_KIT_ITEM_FAILED;
    }
    return facts.recordNotWritten ? EXIT_RECORD_NOT_WRITTEN : EXIT_KIT_COMPLETED;
}
