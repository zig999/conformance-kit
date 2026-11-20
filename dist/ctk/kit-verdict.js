import { KitDidNotRunError } from '../shared/errors.js';
import { failedIdentifiers } from './kit-report.js';
const SUCCESS_EXIT_CODE = 0;
/** CNF-15: a failed item is covered when a deviation names it; the layer passes only when none is left uncovered. */
export function judgeKitItems(items, exitCode, register) {
    const failedItems = failedIdentifiers(items);
    if (exitCode !== SUCCESS_EXIT_CODE && failedItems.length === 0) {
        throw new KitDidNotRunError(`the kit exited with status ${String(exitCode)} and its report holds no failed item`, {
            exitCode: String(exitCode),
        });
    }
    const uncoveredItems = failedItems.filter((identifier) => !register.isExcluded(identifier));
    return { failedItems, uncoveredItems, passed: uncoveredItems.length === 0 };
}
