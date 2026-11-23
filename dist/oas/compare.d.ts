import { type IOasDifference } from './difference.js';
export type { IOasDifference, OasDifferenceKind } from './difference.js';
/**
 * Compares the generated document with the pinned one on paths, operations, schemas, states and response codes (CNF-02).
 * Metadata (openapi, info, servers, tags) and prose (description, summary, example) are not part of the contract.
 */
export declare function compareOas(pinned: unknown, generated: unknown): IOasDifference[];
