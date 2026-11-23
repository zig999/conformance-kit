import { type IOasDifference, type IPair, type JsonRecord } from './difference.js';
export declare function sameValue(first: unknown, second: unknown): boolean;
/** Compares two records member by member. In a map of names (such as `properties`) no key is a keyword to set aside. */
export declare function recordDifferences(pair: IPair<JsonRecord>, pointer: string, namesOnly?: boolean): IOasDifference[];
/**
 * A deep comparison: records by member, anything else by identity. Descriptions, summaries and examples are set aside.
 * A list is read as a set and, where the two differ, is one difference at the pointer of the list itself.
 */
export declare function valueDifferences(pair: IPair<unknown>, pointer: string, namesOnly?: boolean): IOasDifference[];
