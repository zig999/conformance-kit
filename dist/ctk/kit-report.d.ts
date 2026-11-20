import type { IFiles } from '../shared/ports.js';
import { type IKitItem } from './kit-report-shapes.js';
export type { IKitItem } from './kit-report-shapes.js';
/**
 * Reads every .json file of the reports folder (CNF-15). No report, a report with no item, a failed hook, a file that
 * is neither Mocha nor Newman, or a report that does not add up to its own totals means the CTK did not run to the end.
 * (CNF-15 says hooks do not count; a failed one is the exception, because it stops the tests.)
 */
export declare function readKitItems(files: IFiles, reportsDirectory: string): Promise<IKitItem[]>;
export declare function failedIdentifiers(items: readonly IKitItem[]): string[];
