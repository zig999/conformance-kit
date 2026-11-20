import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = new URL('../../src/', import.meta.url).pathname;
const ALLOWED_PACKAGES: readonly string[] = ['yaml', 'zod'];
const SALES_PACKAGES: readonly string[] = ['identity-kit'];

const filesUnder = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)],
  );

const sources = filesUnder(SOURCE_ROOT)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ path: relative(SOURCE_ROOT, file), text: readFileSync(file, 'utf8') }));

const specifiersOf = (text: string): string[] =>
  [...text.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');

const allSpecifiers = (): { path: string; specifier: string }[] =>
  sources.flatMap((source) => specifiersOf(source.text).map((specifier) => ({ path: source.path, specifier })));

describe('the imports of the package', () => {
  it('reach only node built-ins, the allowed packages and the files of the package', () => {
    const foreign = allSpecifiers().filter(
      ({ specifier }) =>
        !specifier.startsWith('.') && !specifier.startsWith('node:') && !ALLOWED_PACKAGES.includes(specifier),
    );
    expect(foreign).toEqual([]);
  });

  it('never import a sales module or the identity kit', () => {
    const sales = allSpecifiers().filter(({ specifier }) =>
      SALES_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`)),
    );
    expect(sales).toEqual([]);
  });

  it('never read the process environment', () => {
    expect(sources.filter((source) => source.text.includes('process.env')).map((source) => source.path)).toEqual([]);
  });

  it('never write to the console', () => {
    expect(sources.filter((source) => source.text.includes('console.')).map((source) => source.path)).toEqual([]);
  });
});

describe('the two parts of the package', () => {
  const importsOf = (folder: string): { path: string; specifier: string }[] =>
    allSpecifiers().filter(({ path }) => path.startsWith(`${folder}/`));

  it('keep the OAS part free of the CTK runner', () => {
    expect(importsOf('oas').filter(({ specifier }) => /\.\.\/(ctk|layers|run)\//.test(specifier))).toEqual([]);
  });

  it('keep the CTK runner free of the OAS part', () => {
    expect(importsOf('ctk').filter(({ specifier }) => /\.\.\/(oas|layers|run)\//.test(specifier))).toEqual([]);
  });
});

describe('the errors of the kit', () => {
  it('are never a plain Error: the kit throws errors of its own types', () => {
    expect(sources.filter((source) => /new Error\(/.test(source.text)).map((source) => source.path)).toEqual([]);
  });
});
