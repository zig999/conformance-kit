import { type IOasDifference, type IPair, type JsonRecord } from './difference.js';
/** One side of the comparison, as far as the parameters of an operation go. */
export interface IParameterSide {
    readonly root: JsonRecord;
    readonly pathItem: JsonRecord;
    readonly operation: JsonRecord;
}
export interface IParameterPointers {
    readonly path: string;
    readonly operation: string;
}
/** The query filters, the paging and the selection of an operation are part of its contract (CNF-02, CNF-03). */
export declare function parameterDifferences(sides: IPair<IParameterSide>, pointers: IParameterPointers): IOasDifference[];
