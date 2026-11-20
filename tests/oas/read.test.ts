import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OasReadError, readOasFrom, sha256Of } from '../../src/oas/read.js';
import { readOasFile, sha256OfFile } from '../../src/index.js';
import { ConformanceError } from '../../src/shared/errors.js';
import { baseDocument } from '../support/oas-documents.js';
import { MemoryFiles } from '../support/memory-files.js';

const PATH = '/contracts/TMF999-v1.0.0.oas.yaml';

describe('reading an OAS', () => {
  it('reads a YAML document', async () => {
    const files = new MemoryFiles().seed(PATH, stringify(baseDocument()));
    expect(await readOasFrom(files, PATH)).toEqual(baseDocument());
  });

  it('reads a JSON document', async () => {
    const files = new MemoryFiles().seed(PATH, JSON.stringify(baseDocument()));
    expect(await readOasFrom(files, PATH)).toEqual(baseDocument());
  });

  it('refuses a file that is not there, naming the file', async () => {
    const reading = readOasFrom(new MemoryFiles(), PATH);
    await expect(reading).rejects.toBeInstanceOf(OasReadError);
    await expect(reading).rejects.toThrow(PATH);
  });

  it('refuses a file that is neither YAML nor JSON', async () => {
    const files = new MemoryFiles().seed(PATH, 'paths: [unclosed');
    await expect(readOasFrom(files, PATH)).rejects.toBeInstanceOf(OasReadError);
  });

  it('refuses a YAML document that repeats a key', async () => {
    const files = new MemoryFiles().seed(PATH, 'openapi: 3.0.1\nopenapi: 3.1.0\npaths: {}\n');
    await expect(readOasFrom(files, PATH)).rejects.toBeInstanceOf(OasReadError);
  });

  it.each([
    ['a list', '- a\n- b\n'],
    ['a scalar', 'plain text'],
    ['an empty file', ''],
    ['a document without paths', 'openapi: 3.0.1\n'],
    ['a document without the openapi member', 'paths: {}\n'],
  ])('refuses %s as an OpenAPI document', async (_name, text) => {
    const files = new MemoryFiles().seed(PATH, text);
    const reading = readOasFrom(files, PATH);
    await expect(reading).rejects.toBeInstanceOf(OasReadError);
    await expect(reading).rejects.toThrow(/not an OpenAPI document/);
  });

  it('is an error of the kit', async () => {
    await expect(readOasFrom(new MemoryFiles(), PATH)).rejects.toBeInstanceOf(ConformanceError);
  });
});

describe('the SHA-256 of a file', () => {
  const expected = (text: string): string => createHash('sha256').update(text).digest('hex');

  it('is the hex digest of the bytes', async () => {
    const files = new MemoryFiles().seed(PATH, 'one');
    expect(await sha256Of(files, PATH)).toBe(expected('one'));
  });

  it('is equal for equal files and different for files that differ by one byte', async () => {
    const files = new MemoryFiles().seed('/a', 'same').seed('/b', 'same').seed('/c', 'same ');
    expect(await sha256Of(files, '/a')).toBe(await sha256Of(files, '/b'));
    expect(await sha256Of(files, '/a')).not.toBe(await sha256Of(files, '/c'));
  });

  it('refuses a file that is not there', async () => {
    await expect(sha256Of(new MemoryFiles(), PATH)).rejects.toBeInstanceOf(OasReadError);
  });
});

describe('the public readers, on real files', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'conformance-kit-oas-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('read a document and digest the exact bytes, including bytes that are not valid text', async () => {
    const path = join(root, 'oas.yaml');
    const bytes = Buffer.concat([Buffer.from(stringify(baseDocument())), Buffer.from([0xff, 0xfe])]);
    await writeFile(path, bytes);
    expect(await sha256OfFile(path)).toBe(createHash('sha256').update(bytes).digest('hex'));
    await writeFile(path, JSON.stringify(baseDocument()));
    expect(await readOasFile(path)).toEqual(baseDocument());
  });
});
