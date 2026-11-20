import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPOSITORY = new URL('../../', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(REPOSITORY, 'package.json'), 'utf8'));
const MODULE_NAMES = [
  'productcatalog',
  'productorder',
  'partymgmt',
  'configurator',
  'quote',
  'inventory',
  'crm-engagement',
  'commercial-agreements',
  'recommendation',
  'salese2e',
  'identity-kit',
];

const scriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? scriptFiles(join(directory, entry.name))
      : entry.name.endsWith('.ts')
        ? [join(directory, entry.name)]
        : [],
  );

describe('the matrix script', () => {
  const files = scriptFiles(join(REPOSITORY, 'scripts'));

  it('lives in scripts/, and the published package has no bin and holds only dist', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(manifest.bin).toBeUndefined();
    expect(manifest.files).toEqual(['dist']);
  });

  it('is run by a script of the manifest, not published', () => {
    expect(manifest.scripts.matrix).toContain('scripts/generate-matrix.ts');
  });

  it('knows the name of no module', () => {
    const naming = files.filter((file) => MODULE_NAMES.some((name) => readFileSync(file, 'utf8').includes(name)));
    expect(naming).toEqual([]);
  });

  it('reads only files named conformance-report, never an environment file or a credentials file', () => {
    const text = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(text).not.toMatch(/\.env|credentials|process\.env/);
  });

  it('validates with the strict schema of the kit', () => {
    const text = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(text).toContain('ConformanceReportSchema');
  });
});
