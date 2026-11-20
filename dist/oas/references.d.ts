import { type JsonRecord } from './difference.js';
/** A response, a request body or a parameter may be given by reference; both sides are read as the thing they refer to. */
export declare function resolved(root: JsonRecord, node: unknown, section: string): JsonRecord;
