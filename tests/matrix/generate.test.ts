import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateMatrix, parseArguments } from '../../scripts/matrix/generate.js';
import { TemporaryRoot, validReport } from '../support/matrix-root.js';

describe('generating the matrix', () => {
  let root: TemporaryRoot;

  beforeEach(async () => {
    root = await TemporaryRoot.create();
  });

  afterEach(async () => {
    await root.remove();
  });

  const output = (): string => join(root.path, 'matriz-conformidade.md');

  it('writes the matrix of every module under the root to the output file', async () => {
    await root.module('inventory-like', { 'conformance-report.json': validReport() });
    await root.module('no-report-yet');
    await root.module('two', {
      'conformance-report.tmf620.json': validReport({ api: 'TMF620' }),
      'conformance-report.tmf671.json': validReport({ api: 'TMF671' }),
    });
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    const text = await readFile(output(), 'utf8');
    expect(text).toContain('| inventory-like | TMF637 | 5.0.0 |');
    expect(text).toContain('| no-report-yet | — |');
    expect(text).toContain('| two | TMF620 |');
    expect(text).toContain('| two | TMF671 |');
    expect(text).toContain('sem relatório');
  });

  it('answers the rows it wrote', async () => {
    await root.module('a', { 'conformance-report.json': validReport() });
    await root.module('b');
    const rows = await generateMatrix({ root: root.path, output: output(), excluded: [] });
    expect(rows.map((row) => row.kind)).toEqual(['report', 'none']);
  });

  it('writes an invalid report as invalid and goes on to write the rest', async () => {
    await root.module('bad', { 'conformance-report.json': 'garbage' });
    await root.module('good', { 'conformance-report.json': validReport() });
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    const text = await readFile(output(), 'utf8');
    expect(text).toMatch(/\| bad \| — \| — \|.*inválido/);
    expect(text).toContain('| good | TMF637 |');
  });

  it('writes the same file when run twice', async () => {
    await root.module('a', { 'conformance-report.json': validReport() });
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    const first = await readFile(output(), 'utf8');
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    expect(await readFile(output(), 'utf8')).toBe(first);
  });

  it('does not carry anything from a file that is not a conformance report', async () => {
    await root.module('a', { 'conformance-report.json': validReport() });
    await root.file('a/backend/.env', 'API_KEY=value-that-must-never-be-read');
    await root.file('a/backend/credentials.md', 'password: value-that-must-never-be-read');
    await root.file('a/backend/conformance-report.txt', 'value-that-must-never-be-read');
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    expect(await readFile(output(), 'utf8')).not.toContain('value-that-must-never-be-read');
  });

  it('leaves out, and names, the folders it is told to exclude', async () => {
    await root.module('in-scope');
    await root.module('left-out', { 'conformance-report.json': validReport() });
    await generateMatrix({ root: root.path, output: output(), excluded: ['left-out'] });
    const text = await readFile(output(), 'utf8');
    expect(text).not.toContain('| left-out |');
    expect(text).toContain('`left-out`');
  });

  it('replaces a matrix that was there, and writes nothing else under the root', async () => {
    await root.module('a');
    await writeFile(output(), 'old, hand-written content');
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    expect(await readFile(output(), 'utf8')).not.toContain('hand-written');
    expect((await readdir(root.path)).toSorted()).toEqual(['a', 'matriz-conformidade.md']);
  });

  it('never reads or writes outside the temporary root', async () => {
    await root.module('a', { 'conformance-report.json': validReport() });
    await generateMatrix({ root: root.path, output: output(), excluded: [] });
    expect(output().startsWith(root.path)).toBe(true);
  });
});

describe('the arguments of the script', () => {
  it('default to the folder above the repository and to matriz-conformidade.md in it', () => {
    expect(parseArguments([], '/sales/conformance-kit/scripts')).toEqual({
      root: '/sales',
      output: '/sales/matriz-conformidade.md',
      excluded: [],
    });
  });

  it('take --root, --output and any number of --exclude', () => {
    expect(
      parseArguments(
        ['--root', '/r', '--output', '/o.md', '--exclude', 'a', '--exclude', 'b'],
        '/sales/conformance-kit/scripts',
      ),
    ).toEqual({ root: '/r', output: '/o.md', excluded: ['a', 'b'] });
  });

  it('put the default output inside a given root', () => {
    expect(parseArguments(['--root', '/r'], '/sales/conformance-kit/scripts').output).toBe('/r/matriz-conformidade.md');
  });

  it.each([['--root'], ['--exclude'], ['--unknown', 'x'], ['stray']])('refuse the arguments %j', (...args) => {
    expect(() => parseArguments(args.flat(), '/x/y/z')).toThrow(/argument/i);
  });
});
