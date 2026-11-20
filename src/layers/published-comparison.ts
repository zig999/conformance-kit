import { compareOas } from '../oas/compare.js';
import { assertOasDocument, readOasFrom } from '../oas/read.js';
import type { IDeviationRegister } from '../deviations/register.js';
import { describeError } from '../shared/errors.js';
import type { IFiles } from '../shared/ports.js';
import { RESULT_FAILED, RESULT_PASSED, type LayerResult } from '../report/record.js';

export interface IPublishedComparisonInput {
  readonly pinnedOas: string;
  readonly generatedOas: () => Promise<unknown>;
}

export interface IPublishedComparisonEffects {
  readonly files: IFiles;
  readonly log: (message: string) => void;
}

export interface IPublishedComparisonOutcome {
  readonly result: LayerResult;
  /** Every difference found, covered or not; the record names the deviations that cover them. */
  readonly differences: readonly string[];
}

const UNREADABLE: IPublishedComparisonOutcome = { result: RESULT_FAILED, differences: [] };

/** Layer 2 (CNF-02): every difference is a failure unless a deviation covers its pointer. */
export async function runPublishedComparison(
  effects: IPublishedComparisonEffects,
  input: IPublishedComparisonInput,
  register: IDeviationRegister,
): Promise<IPublishedComparisonOutcome> {
  try {
    const pinned = await readOasFrom(effects.files, input.pinnedOas);
    const generated = assertOasDocument(await input.generatedOas(), 'the generated document');
    const differences = compareOas(pinned, generated).map((difference) => difference.pointer);
    const uncovered = differences.filter((pointer) => !register.isCovered(pointer));
    uncovered.forEach((pointer) =>
      effects.log(`the generated document differs from the pinned one at ${pointer}, which no deviation covers`),
    );
    return { result: uncovered.length === 0 ? RESULT_PASSED : RESULT_FAILED, differences };
  } catch (error) {
    effects.log(`the comparison of the published document could not be completed: ${describeError(error)}`);
    return UNREADABLE;
  }
}
