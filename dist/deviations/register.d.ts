import type { IFiles } from '../shared/ports.js';
export interface IDeviation {
    readonly node: string;
    readonly coveredPointers: readonly string[];
    readonly excludedItems: readonly string[];
}
export interface IDeviationRegister {
    readonly entries: readonly IDeviation[];
    isCovered(pointer: string): boolean;
    isExcluded(identifier: string): boolean;
}
/** Reads the conformance node and every deviation node its `excludes:` block lists (CNF-05, CNF-06). */
export declare function readDeviationRegisterFrom(files: IFiles, specificationRoot: string, conformanceNode: string): Promise<IDeviationRegister>;
export declare function readDeviationRegister(specificationRoot: string, conformanceNode: string): Promise<IDeviationRegister>;
