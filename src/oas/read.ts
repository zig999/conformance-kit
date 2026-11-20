import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { ConformanceError } from '../shared/errors.js';
import { createNodeFiles } from '../shared/node-files.js';
import type { IFiles } from '../shared/ports.js';
import { isRecord, type JsonRecord } from './difference.js';

/** An OAS could not be read, or is not an OpenAPI document. */
export class OasReadError extends ConformanceError {}

async function readBytesOf(files: IFiles, path: string): Promise<Uint8Array> {
  try {
    return await files.readBytes(path);
  } catch (cause) {
    throw new OasReadError(`the file ${path} cannot be read`, { path }, { cause });
  }
}

/** Refuses what is not an OpenAPI document: an object with an `openapi` member and a `paths` object. */
export function assertOasDocument(value: unknown, origin: string): JsonRecord {
  if (!isRecord(value) || typeof value['openapi'] !== 'string' || !isRecord(value['paths'])) {
    throw new OasReadError(`${origin} is not an OpenAPI document: it needs an openapi member and a paths object`, {
      origin,
    });
  }
  return value;
}

/** Reads an OAS written as YAML or JSON (JSON is YAML). A repeated key is refused. */
export async function readOasFrom(files: IFiles, path: string): Promise<JsonRecord> {
  const text = new TextDecoder().decode(await readBytesOf(files, path));
  let document: unknown;
  try {
    document = parse(text);
  } catch (cause) {
    throw new OasReadError(`the file ${path} is neither YAML nor JSON`, { path }, { cause });
  }
  return assertOasDocument(document, `the file ${path}`);
}

export async function sha256Of(files: IFiles, path: string): Promise<string> {
  return createHash('sha256')
    .update(await readBytesOf(files, path))
    .digest('hex');
}

export function readOasFile(path: string): Promise<JsonRecord> {
  return readOasFrom(createNodeFiles(), path);
}

export function sha256OfFile(path: string): Promise<string> {
  return sha256Of(createNodeFiles(), path);
}
