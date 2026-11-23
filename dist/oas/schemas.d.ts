import { type IOasDifference, type IPair, type JsonRecord } from './difference.js';
/** Named schemas: presence, keywords (states included) and members, flattened through allOf (CNF-02). */
export declare function schemaSetDifferences(roots: IPair<JsonRecord>): IOasDifference[];
