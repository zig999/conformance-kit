import { type IOasDifference, type IPair, type JsonRecord } from './difference.js';
/** Paths, operations, request bodies and response codes, with the schema each one carries (CNF-02). */
export declare function pathDifferences(roots: IPair<JsonRecord>): IOasDifference[];
