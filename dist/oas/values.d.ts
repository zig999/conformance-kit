import { type IOasDifference, type IPair, type JsonRecord } from './difference.js';
export declare function sameValue(first: unknown, second: unknown): boolean;
/** Compares two records member by member. In a map of names (such as `properties`) no key is a keyword to set aside. */
export declare function recordDifferences(pair: IPair<JsonRecord>, pointer: string, namesOnly?: boolean): IOasDifference[];
/** A deep comparison: records by member, arrays as sets, anything else by identity. Descriptions, summaries and examples are set aside. */
export declare function valueDifferences(pair: IPair<unknown>, pointer: string, namesOnly?: boolean): IOasDifference[];
