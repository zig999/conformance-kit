import type { IDeviationRegister } from '../deviations/register.js';
import { KitDidNotRunError } from '../shared/errors.js';
import { failedIdentifiers, type IKitItem } from './kit-report.js';

const SUCCESS_EXIT_CODE = 0;

export interface IKitVerdict {
  readonly failedItems: readonly string[];
  readonly uncoveredItems: readonly string[];
  readonly passed: boolean;
}

/** CNF-15: a failed item is covered when a deviation names it; the layer passes only when none is left uncovered. */
export function judgeKitItems(items: readonly IKitItem[], exitCode: number, register: IDeviationRegister): IKitVerdict {
  const failedItems = failedIdentifiers(items);
  if (exitCode !== SUCCESS_EXIT_CODE && failedItems.length === 0) {
    throw new KitDidNotRunError(`the kit exited with status ${String(exitCode)} and its report holds no failed item`, {
      exitCode: String(exitCode),
    });
  }
  const uncoveredItems = failedItems.filter((identifier) => !register.isExcluded(identifier));
  return { failedItems, uncoveredItems, passed: uncoveredItems.length === 0 };
}
