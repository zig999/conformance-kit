import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findModules } from '../../scripts/matrix/modules.js';
import { resultOf, rowsOfModule } from '../../scripts/matrix/rows.js';
import { TemporaryRoot, validReport } from '../support/matrix-root.js';

describe('the rows of a module', () => {
  let root: TemporaryRoot;

  beforeEach(async () => {
    root = await TemporaryRoot.create();
  });

  afterEach(async () => {
    await root.remove();
  });

  const rowsOf = async (reports: Record<string, string | Record<string, unknown>>) => {
    await root.module('alpha', reports);
    const [module] = await findModules(root.path, []);
    return rowsOfModule(root.path, module ?? { name: '', reportFiles: [] });
  };

  it('has one row, with the api, the version, the four layers, the deviation count and the date, for a valid report', async () => {
    const [row] = await rowsOf({ 'conformance-report.json': validReport() });
    expect(row).toMatchObject({
      module: 'alpha',
      kind: 'report',
      api: 'TMF637',
      version: '5.0.0',
      layers: ['passed', 'passed', 'passed', 'passed'],
      deviations: 2,
      date: '2026-11-20T11:12:00.000Z',
      outcome: 'approved',
    });
  });

  it('has one row per report file when the module has several APIs, sorted by API', async () => {
    const rows = await rowsOf({
      'conformance-report.tmf671.json': validReport({ api: 'TMF671' }),
      'conformance-report.tmf620.json': validReport({ api: 'TMF620' }),
    });
    expect(rows.map((row) => (row.kind === 'report' ? row.api : ''))).toEqual(['TMF620', 'TMF671']);
  });

  it('has one row saying there is no report when the module has none', async () => {
    expect(await rowsOf({})).toEqual([{ module: 'alpha', kind: 'none' }]);
  });

  it('keeps not-applicable, as the layer 4 of an API with no kit', async () => {
    const results = { ...(validReport()['results'] as Record<string, string>), conformanceKit: 'not-applicable' };
    const [row] = await rowsOf({ 'conformance-report.json': validReport({ results }) });
    expect(row).toMatchObject({
      kind: 'report',
      layers: ['passed', 'passed', 'passed', 'not-applicable'],
      outcome: 'approved',
    });
  });

  it('counts the deviations of the report', async () => {
    const [row] = await rowsOf({ 'conformance-report.json': validReport({ deviationsApplied: [] }) });
    expect(row).toMatchObject({ deviations: 0 });
  });

  describe('a report that is not valid', () => {
    const invalidReason = async (reports: Record<string, string | Record<string, unknown>>) => {
      const [row] = await rowsOf(reports);
      expect(row?.kind).toBe('invalid');
      return row?.kind === 'invalid' ? row : undefined;
    };

    it('is invalid when the file is not JSON, and the row names the API of the file', async () => {
      const row = await invalidReason({ 'conformance-report.tmf637.json': 'not json {' });
      expect(row).toMatchObject({ api: 'TMF637' });
      expect(row?.reason).toMatch(/JSON/);
    });

    it('is invalid when the file is not JSON and the name has no API, with no API in the row', async () => {
      expect(await invalidReason({ 'conformance-report.json': '' })).toMatchObject({ api: undefined });
    });

    it('is invalid with an unknown key, naming the key and not its value', async () => {
      const row = await invalidReason({ 'conformance-report.json': validReport({ extra: 'a-secret-looking-value' }) });
      expect(row?.reason).toContain('extra');
      expect(row?.reason).not.toContain('a-secret-looking-value');
    });

    it('is invalid with a result outside passed, failed and not-run, naming the key and not the value', async () => {
      const results = { ...(validReport()['results'] as Record<string, string>), answerValidation: 'maybe-ok' };
      const row = await invalidReason({ 'conformance-report.json': validReport({ results }) });
      expect(row?.reason).toContain('results.answerValidation');
      expect(row?.reason).not.toContain('maybe-ok');
    });

    it('is invalid when not-applicable is in any layer but the fourth', async () => {
      const results = { ...(validReport()['results'] as Record<string, string>), pinnedCopyIdentity: 'not-applicable' };
      expect((await invalidReason({ 'conformance-report.json': validReport({ results }) }))?.reason).toContain(
        'results.pinnedCopyIdentity',
      );
    });

    it('is invalid when the file name carries another API than the report', async () => {
      const row = await invalidReason({ 'conformance-report.tmf671.json': validReport({ api: 'TMF637' }) });
      expect(row?.reason).toMatch(/nome do arquivo/);
    });

    it('does not stop the other reports of the module from being read', async () => {
      const rows = await rowsOf({
        'conformance-report.tmf620.json': 'broken',
        'conformance-report.tmf671.json': validReport({ api: 'TMF671' }),
      });
      expect(rows.map((row) => row.kind)).toEqual(['invalid', 'report']);
    });
  });
});

describe('the outcome of a report', () => {
  const layers = (...values: string[]) => values as ['passed', 'passed', 'passed', 'passed'];

  it('is approved when layers 1 to 3 passed and layer 4 passed or does not apply', () => {
    expect(resultOf(layers('passed', 'passed', 'passed', 'passed'))).toBe('approved');
    expect(resultOf(layers('passed', 'passed', 'passed', 'not-applicable'))).toBe('approved');
  });

  it('is rejected as soon as one layer failed, even when another did not run', () => {
    expect(resultOf(layers('passed', 'failed', 'passed', 'passed'))).toBe('rejected');
    expect(resultOf(layers('not-run', 'passed', 'passed', 'failed'))).toBe('rejected');
  });

  it('is incomplete when no layer failed and one did not run', () => {
    expect(resultOf(layers('passed', 'passed', 'passed', 'not-run'))).toBe('incomplete');
    expect(resultOf(layers('not-run', 'not-run', 'not-run', 'not-run'))).toBe('incomplete');
  });
});
