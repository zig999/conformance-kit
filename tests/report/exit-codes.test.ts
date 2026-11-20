import { describe, expect, it } from 'vitest';
import {
  EXIT_CONFIGURATION_REFUSED,
  EXIT_KIT_COMPLETED,
  EXIT_KIT_DID_NOT_RUN,
  EXIT_KIT_ITEM_FAILED,
  EXIT_RECORD_NOT_WRITTEN,
  EXIT_TEARDOWN_FAILED,
  exitCodeOf,
  type IExitFacts,
} from '../../src/report/exit-codes.js';

const nothing: IExitFacts = {
  configurationRefused: false,
  kitDidNotRun: false,
  teardownFailed: false,
  kitItemFailed: false,
  recordNotWritten: false,
};

describe('the exit codes', () => {
  it('are the six codes of the standard', () => {
    expect([
      EXIT_KIT_COMPLETED,
      EXIT_KIT_DID_NOT_RUN,
      EXIT_CONFIGURATION_REFUSED,
      EXIT_TEARDOWN_FAILED,
      EXIT_KIT_ITEM_FAILED,
      EXIT_RECORD_NOT_WRITTEN,
    ]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('is 0 when the kit completed and nothing went wrong', () => {
    expect(exitCodeOf(nothing)).toBe(0);
  });

  it.each([
    ['configurationRefused', 2],
    ['kitDidNotRun', 1],
    ['teardownFailed', 3],
    ['kitItemFailed', 4],
    ['recordNotWritten', 5],
  ] as const)('is %s -> %i when only that happened', (fact, code) => {
    expect(exitCodeOf({ ...nothing, [fact]: true })).toBe(code);
  });

  it('follows the precedence 2, 1, 3, 4, 5', () => {
    const everything: IExitFacts = {
      configurationRefused: true,
      kitDidNotRun: true,
      teardownFailed: true,
      kitItemFailed: true,
      recordNotWritten: true,
    };
    const order: (keyof IExitFacts)[] = [
      'configurationRefused',
      'kitDidNotRun',
      'teardownFailed',
      'kitItemFailed',
      'recordNotWritten',
    ];
    const codes: number[] = [];
    let facts = everything;
    for (const fact of order) {
      codes.push(exitCodeOf(facts));
      facts = { ...facts, [fact]: false };
    }
    expect(codes).toEqual([2, 1, 3, 4, 5]);
    expect(exitCodeOf(facts)).toBe(0);
  });

  it('lets a failed teardown prevail over a kit that passed', () => {
    expect(exitCodeOf({ ...nothing, teardownFailed: true })).toBe(3);
  });

  it('lets a failed item prevail over a record that was not written', () => {
    expect(exitCodeOf({ ...nothing, kitItemFailed: true, recordNotWritten: true })).toBe(4);
  });
});
