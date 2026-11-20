import type { IFiles } from '../shared/ports.js';
import { type IKitItem } from './kit-report-shapes.js';
export type { IKitItem } from './kit-report-shapes.js';
/** Reads every .json file of the reports folder (CNF-15). No report, or a report with no item, means the CTK did not run to the end. */
export declare function readKitItems(files: IFiles, reportsDirectory: string): Promise<IKitItem[]>;
export declare function failedIdentifiers(items: readonly IKitItem[]): string[];
