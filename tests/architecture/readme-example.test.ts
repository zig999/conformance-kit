import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPOSITORY = new URL('../../', import.meta.url).pathname;
const README = readFileSync(join(REPOSITORY, 'README.md'), 'utf8');
const BLOCK = /```ts compiled ([^\n]+)\n([\s\S]*?)```/g;

/** What the module owns and the examples import. The README says so; here they only need a type. */
const MODULE_FILES: Readonly<Record<string, string>> = {
  'backend/src/conformance/generated-document.ts':
    'export const generatedDocument = async (): Promise<unknown> => ({});\n',
  'backend/tests/support/catalog-stand-in.ts':
    'export const startCatalogStandIn = async (): Promise<{ baseUrl: string; close(): Promise<void> }> => ({ baseUrl: "", close: async () => undefined });\n',
};

const blocks = [...README.matchAll(BLOCK)].map((match) => ({ path: match[1] ?? '', text: match[2] ?? '' }));

describe('the examples of the README', () => {
  let project = '';

  beforeAll(() => {
    const cache = join(REPOSITORY, 'node_modules', '.cache');
    mkdirSync(cache, { recursive: true });
    project = mkdtempSync(join(cache, 'readme-check-'));
    const files = { ...MODULE_FILES, ...Object.fromEntries(blocks.map((block) => [block.path, block.text])) };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), text);
    }
    writeFileSync(
      join(project, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2023',
          lib: ['ES2023'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          noEmit: true,
          skipLibCheck: true,
          types: ['node'],
          paths: { 'conformance-kit': [join(REPOSITORY, 'src', 'index.ts')] },
        },
        include: ['backend/**/*.ts'],
      }),
    );
  });

  afterAll(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('holds the complete backend/scripts/conformance.ts, and the examples of the contract tests', () => {
    expect(blocks.map((block) => block.path)).toEqual(
      expect.arrayContaining([
        'backend/scripts/conformance.ts',
        'backend/scripts/conformance-compose.ts',
        'backend/tests/contract/pinned-copy.test.ts',
        'backend/tests/contract/published-document.test.ts',
      ]),
    );
  });

  it('compile against the public interface', () => {
    const compile = (): string =>
      execFileSync(join(REPOSITORY, 'node_modules', '.bin', 'tsc'), ['-p', join(project, 'tsconfig.json')], {
        encoding: 'utf8',
      });
    try {
      compile();
    } catch (error) {
      const output = error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
      expect(output).toBe('');
    }
  });

  it('never hold a token or the value of a variable', () => {
    expect(blocks.map((block) => block.text).join('\n')).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
  });
});
