import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { ConformanceError } from '../shared/errors.js';
import { createNodeFiles } from '../shared/node-files.js';
import { isRecord } from './difference.js';
/** An OAS could not be read, or is not an OpenAPI document. */
export class OasReadError extends ConformanceError {
}
async function readBytesOf(files, path) {
    try {
        return await files.readBytes(path);
    }
    catch (cause) {
        throw new OasReadError(`the file ${path} cannot be read`, { path }, { cause });
    }
}
/** Refuses what is not an OpenAPI document: an object with an `openapi` member and a `paths` object. */
export function assertOasDocument(value, origin) {
    if (!isRecord(value) || typeof value['openapi'] !== 'string' || !isRecord(value['paths'])) {
        throw new OasReadError(`${origin} is not an OpenAPI document: it needs an openapi member and a paths object`, {
            origin,
        });
    }
    return value;
}
/** Reads an OAS written as YAML or JSON (JSON is YAML). A repeated key is refused. */
export async function readOasFrom(files, path) {
    const text = new TextDecoder().decode(await readBytesOf(files, path));
    let document;
    try {
        document = parse(text);
    }
    catch (cause) {
        throw new OasReadError(`the file ${path} is neither YAML nor JSON`, { path }, { cause });
    }
    return assertOasDocument(document, `the file ${path}`);
}
export async function sha256Of(files, path) {
    return createHash('sha256')
        .update(await readBytesOf(files, path))
        .digest('hex');
}
export function readOasFile(path) {
    return readOasFrom(createNodeFiles(), path);
}
export function sha256OfFile(path) {
    return sha256Of(createNodeFiles(), path);
}
