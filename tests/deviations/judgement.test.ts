import { describe, expect, it } from 'vitest';
import { deviationsApplied } from '../../src/deviations/applied.js';
import { readDeviationRegisterFrom } from '../../src/deviations/register.js';
import { judgeKitItems } from '../../src/ctk/kit-verdict.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import { CONFORMANCE_NODE, SPECIFICATION_ROOT, nodeText, specificationWith } from '../support/deviation-nodes.js';

const FIRST = 'constraints/tmf999-first';
const SECOND = 'constraints/tmf999-second';

const register = () =>
  readDeviationRegisterFrom(
    specificationWith({
      [FIRST]: nodeText('statement: Excludes `known failure` and covers "/paths/~1a/get"'),
      [SECOND]: nodeText('statement: Excludes `other failure`'),
    }),
    SPECIFICATION_ROOT,
    CONFORMANCE_NODE,
  );

const item = (identifier: string, passed: boolean) => ({ identifier, passed });

describe('the verdict on the items of the kit', () => {
  it('passes when every item passed', async () => {
    const verdict = judgeKitItems([item('a', true)], 0, await register());
    expect(verdict).toEqual({ failedItems: [], uncoveredItems: [], passed: true });
  });

  it('passes when a failed item is covered by a deviation', async () => {
    const verdict = judgeKitItems([item('known failure', false), item('a', true)], 1, await register());
    expect(verdict).toEqual({ failedItems: ['known failure'], uncoveredItems: [], passed: true });
  });

  it('fails when a failed item is covered by no deviation', async () => {
    const verdict = judgeKitItems([item('known failure', false), item('surprise', false)], 1, await register());
    expect(verdict).toEqual({
      failedItems: ['known failure', 'surprise'],
      uncoveredItems: ['surprise'],
      passed: false,
    });
  });

  it('does not take a pointer for an excluded item', async () => {
    const verdict = judgeKitItems([item('/paths/~1a/get', false)], 1, await register());
    expect(verdict.passed).toBe(false);
  });

  it('judges an item that passed even when a deviation names it', async () => {
    const verdict = judgeKitItems([item('known failure', true)], 0, await register());
    expect(verdict).toEqual({ failedItems: [], uncoveredItems: [], passed: true });
  });

  it('says the kit did not run to the end when it exits with a failure and the report holds no failed item', async () => {
    const known = await register();
    expect(() => judgeKitItems([item('a', true)], 2, known)).toThrow(KitDidNotRunError);
    expect(() => judgeKitItems([item('a', true)], 2, known)).toThrow(/exited with status 2/);
  });
});

describe('the deviations applied', () => {
  it('names a deviation whose excluded item failed', async () => {
    expect(deviationsApplied(await register(), { failedItems: ['other failure'], differences: [] })).toEqual([SECOND]);
  });

  it('names a deviation whose pointer differs', async () => {
    expect(deviationsApplied(await register(), { failedItems: [], differences: ['/paths/~1a/get'] })).toEqual([FIRST]);
  });

  it('names a deviation once, however many of its items and pointers occur', async () => {
    const applied = deviationsApplied(await register(), {
      failedItems: ['known failure'],
      differences: ['/paths/~1a/get'],
    });
    expect(applied).toEqual([FIRST]);
  });

  it('names no deviation when nothing failed and nothing differs', async () => {
    expect(deviationsApplied(await register(), { failedItems: [], differences: [] })).toEqual([]);
  });

  it('names no deviation when there is no register', () => {
    expect(deviationsApplied(undefined, { failedItems: ['x'], differences: ['/y'] })).toEqual([]);
  });
});
