import { describe, expect, it } from 'vitest';
import {
  ConformanceReportSchema,
  buildReport,
  notRunResults,
  recordRun,
  reportPathOf,
  type IConformanceReport,
} from '../../src/report/record.js';
import { MemoryFiles } from '../support/memory-files.js';

const valid = (): IConformanceReport => ({
  api: 'TMF637',
  openapiVersion: '5.0.0',
  date: '2026-11-20T12:00:00.000Z',
  results: {
    pinnedCopyIdentity: 'passed',
    publishedDocumentComparison: 'passed',
    answerValidation: 'failed',
    conformanceKit: 'not-run',
  },
  deviationsApplied: ['constraints/tmf637-deviation-example'],
});

describe('the schema of the conformance report', () => {
  it('accepts the format of the standard', () => {
    expect(ConformanceReportSchema.safeParse(valid()).success).toBe(true);
  });

  it('refuses an unknown key at the top and inside the results', () => {
    expect(ConformanceReportSchema.safeParse({ ...valid(), extra: 1 }).success).toBe(false);
    const inside = { ...valid(), results: { ...valid().results, extra: 'passed' } };
    expect(ConformanceReportSchema.safeParse(inside).success).toBe(false);
  });

  it.each(['not run', 'PASSED', 'ok', '', 'skipped'])('refuses the result %j', (result) => {
    const report = { ...valid(), results: { ...valid().results, conformanceKit: result } };
    expect(ConformanceReportSchema.safeParse(report).success).toBe(false);
  });

  it('accepts not-applicable in conformanceKit, and only there', () => {
    const results = { ...valid().results, conformanceKit: 'not-applicable' };
    expect(ConformanceReportSchema.safeParse({ ...valid(), results }).success).toBe(true);
    for (const key of ['pinnedCopyIdentity', 'publishedDocumentComparison', 'answerValidation']) {
      const misplaced = { ...valid().results, [key]: 'not-applicable' };
      expect(ConformanceReportSchema.safeParse({ ...valid(), results: misplaced }).success).toBe(false);
    }
  });

  it('refuses a missing key', () => {
    const { deviationsApplied: _omitted, ...incomplete } = valid();
    expect(ConformanceReportSchema.safeParse(incomplete).success).toBe(false);
  });

  it('refuses a deviation listed twice', () => {
    const node = 'constraints/tmf637-deviation-example';
    expect(ConformanceReportSchema.safeParse({ ...valid(), deviationsApplied: [node, node] }).success).toBe(false);
  });

  it('refuses a deviation identifier outside the pattern', () => {
    expect(ConformanceReportSchema.safeParse({ ...valid(), deviationsApplied: ['Constraints/X'] }).success).toBe(false);
  });

  it('refuses a date that is not ISO 8601 with a zone', () => {
    expect(ConformanceReportSchema.safeParse({ ...valid(), date: '2026-11-20' }).success).toBe(false);
  });

  it('refuses a version that is not three numbers', () => {
    expect(ConformanceReportSchema.safeParse({ ...valid(), openapiVersion: 'v5' }).success).toBe(false);
  });
});

describe('building the report', () => {
  it('gives the four layers as not-run when none ran', () => {
    expect(notRunResults()).toEqual({
      pinnedCopyIdentity: 'not-run',
      publishedDocumentComparison: 'not-run',
      answerValidation: 'not-run',
      conformanceKit: 'not-run',
    });
  });

  it('puts the api, the version, the date as ISO 8601 and the results together', () => {
    const report = buildReport({
      api: 'TMF637',
      openapiVersion: '5.0.0',
      date: new Date('2026-11-20T12:00:00Z'),
      results: notRunResults(),
      deviationsApplied: [],
    });
    expect(report).toEqual({
      api: 'TMF637',
      openapiVersion: '5.0.0',
      date: '2026-11-20T12:00:00.000Z',
      results: notRunResults(),
      deviationsApplied: [],
    });
  });
});

describe('where the report goes', () => {
  it('is conformance-report.json for a module with one API', () => {
    expect(reportPathOf('/backend', 'TMF637', false)).toBe('/backend/conformance-report.json');
  });

  it('is conformance-report.<api>.json, in lower case, for a module with several APIs', () => {
    expect(reportPathOf('/backend', 'TMF671', true)).toBe('/backend/conformance-report.tmf671.json');
  });
});

describe('recording the run', () => {
  const log: string[] = [];

  it('writes the report as JSON with a final line break', async () => {
    const files = new MemoryFiles();
    expect(
      await recordRun(files, { path: '/backend/conformance-report.json', report: valid() }, (m) => log.push(m)),
    ).toBe(true);
    const text = files.textOf('/backend/conformance-report.json') ?? '';
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(valid());
  });

  it('answers false and says why when the file cannot be written', async () => {
    const files = new MemoryFiles().failOn('writeText', 'conformance-report');
    const messages: string[] = [];
    expect(
      await recordRun(files, { path: '/backend/conformance-report.json', report: valid() }, (m) => messages.push(m)),
    ).toBe(false);
    expect(messages.join('\n')).toMatch(/could not be written/);
    expect(files.textOf('/backend/conformance-report.json')).toBeUndefined();
  });

  it('writes nothing, and answers false, when the report does not match the schema', async () => {
    const files = new MemoryFiles();
    const unfit = { ...valid(), api: '' };
    expect(
      await recordRun(files, { path: '/backend/conformance-report.json', report: unfit }, (m) => log.push(m)),
    ).toBe(false);
    expect(files.entries.size).toBe(0);
  });
});
