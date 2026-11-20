import { describe, expect, it } from 'vitest';
import { renderMatrix } from '../../scripts/matrix/render.js';
import type { IMatrixRow } from '../../scripts/matrix/rows.js';

const report = (overrides: Partial<Extract<IMatrixRow, { kind: 'report' }>> = {}): IMatrixRow => ({
  module: 'alpha',
  kind: 'report',
  api: 'TMF637',
  version: '5.0.0',
  layers: ['passed', 'passed', 'passed', 'passed'],
  deviations: 4,
  date: '2026-11-20T11:12:00.000Z',
  outcome: 'approved',
  ...overrides,
});

const linesOf = (text: string): string[] => text.split('\n');

describe('the matrix', () => {
  it('has a header, a row per API with module, API, version, the four layers, outcome, deviations and date', () => {
    const lines = linesOf(renderMatrix([report()], []));
    expect(lines).toContain(
      '| Módulo | API | Versão | Camada 1 | Camada 2 | Camada 3 | Camada 4 | Resultado | Desvios | Data |',
    );
    expect(lines).toContain(
      '| alpha | TMF637 | 5.0.0 | passou | passou | passou | passou | aprovada | 4 | 2026-11-20T11:12:00.000Z |',
    );
  });

  it('says not-applicable as "não se aplica" and not-run as "não rodou"', () => {
    const text = renderMatrix(
      [report({ layers: ['passed', 'passed', 'not-run', 'not-applicable'], outcome: 'incomplete' })],
      [],
    );
    expect(text).toContain('| passou | passou | não rodou | não se aplica | incompleta |');
  });

  it('says failed as "falhou" and an outcome of rejected as "reprovada"', () => {
    const text = renderMatrix([report({ layers: ['passed', 'failed', 'passed', 'passed'], outcome: 'rejected' })], []);
    expect(text).toContain('| passou | falhou | passou | passou | reprovada |');
  });

  it('shows a module with no report as "sem relatório"', () => {
    const text = renderMatrix([{ module: 'beta', kind: 'none' }], []);
    expect(linesOf(text)).toContain('| beta | — | — | — | — | — | — | sem relatório | — | — |');
  });

  it('shows an invalid report as "inválido" with the reason, without the layers', () => {
    const text = renderMatrix([{ module: 'beta', kind: 'invalid', api: 'TMF620', reason: 'o arquivo não é JSON' }], []);
    expect(linesOf(text)).toContain('| beta | TMF620 | — | — | — | — | — | inválido: o arquivo não é JSON | — | — |');
  });

  it('shows the API as a dash when an invalid report has none', () => {
    const text = renderMatrix([{ module: 'beta', kind: 'invalid', api: undefined, reason: 'x' }], []);
    expect(text).toContain('| beta | — | — |');
  });

  it('keeps a pipe in a reason from breaking the table', () => {
    const text = renderMatrix([{ module: 'beta', kind: 'invalid', api: undefined, reason: 'a | b' }], []);
    expect(text).toContain('inválido: a \\| b');
  });

  it('says it was generated, and that it must not be edited by hand, and explains the legend', () => {
    const text = renderMatrix([report()], []);
    expect(text).toMatch(/gerada/i);
    expect(text).toMatch(/não edite à mão/i);
    expect(text).toContain('aprovada');
    expect(text).toContain('incompleta');
    expect(text).toContain('reprovada');
  });

  it('names the folders that were left out, when there are any', () => {
    expect(renderMatrix([report()], ['salese2e', 'tmforum'])).toContain('`salese2e`, `tmforum`');
    expect(renderMatrix([report()], [])).not.toContain('excluídas');
  });

  it('says there is nothing to show when there is no module', () => {
    expect(renderMatrix([], [])).toMatch(/nenhum módulo/i);
  });

  it('is the same text for the same rows', () => {
    expect(renderMatrix([report()], ['x'])).toBe(renderMatrix([report()], ['x']));
  });

  it('ends with one line break', () => {
    expect(renderMatrix([report()], []).endsWith('\n')).toBe(true);
    expect(renderMatrix([report()], []).endsWith('\n\n')).toBe(false);
  });
});
