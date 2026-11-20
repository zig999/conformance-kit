import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface IReportFixture {
  readonly api?: string;
  readonly openapiVersion?: string;
  readonly date?: string;
  readonly results?: Readonly<Record<string, string>>;
  readonly deviationsApplied?: readonly string[];
  readonly [extra: string]: unknown;
}

export const validReport = (overrides: IReportFixture = {}): Record<string, unknown> => ({
  api: 'TMF637',
  openapiVersion: '5.0.0',
  date: '2026-11-20T11:12:00.000Z',
  results: {
    pinnedCopyIdentity: 'passed',
    publishedDocumentComparison: 'passed',
    answerValidation: 'passed',
    conformanceKit: 'passed',
  },
  deviationsApplied: ['constraints/tmf637-one', 'constraints/tmf637-two'],
  ...overrides,
});

/** A temporary stand-in for the root of the sales modules. It is never the real one. */
export class TemporaryRoot {
  readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  static async create(): Promise<TemporaryRoot> {
    return new TemporaryRoot(await mkdtemp(join(tmpdir(), 'conformance-kit-matrix-')));
  }

  /** A module: a folder with backend/package.json (the content of that file is never read). */
  async module(name: string, reports: Readonly<Record<string, string | Record<string, unknown>>> = {}): Promise<void> {
    const backend = join(this.path, name, 'backend');
    await mkdir(backend, { recursive: true });
    await writeFile(join(backend, 'package.json'), '{}');
    for (const [file, content] of Object.entries(reports)) {
      await writeFile(join(backend, file), typeof content === 'string' ? content : JSON.stringify(content));
    }
  }

  async file(relativePath: string, content: string): Promise<void> {
    const path = join(this.path, relativePath);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content);
  }

  remove(): Promise<void> {
    return rm(this.path, { recursive: true, force: true });
  }
}
