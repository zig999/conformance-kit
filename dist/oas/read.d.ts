import { ConformanceError } from '../shared/errors.js';
import type { IFiles } from '../shared/ports.js';
import { type JsonRecord } from './difference.js';
/** An OAS could not be read, or is not an OpenAPI document. */
export declare class OasReadError extends ConformanceError {
}
/** Refuses what is not an OpenAPI document: an object with an `openapi` member and a `paths` object. */
export declare function assertOasDocument(value: unknown, origin: string): JsonRecord;
/** Reads an OAS written as YAML or JSON (JSON is YAML). A repeated key is refused. */
export declare function readOasFrom(files: IFiles, path: string): Promise<JsonRecord>;
export declare function sha256Of(files: IFiles, path: string): Promise<string>;
export declare function readOasFile(path: string): Promise<JsonRecord>;
export declare function sha256OfFile(path: string): Promise<string>;
