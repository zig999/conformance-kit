import { z } from 'zod';
import { normalizeIdentifier } from '../shared/identifier.js';

export interface IKitItem {
  readonly identifier: string;
  readonly passed: boolean;
}

/** What one CTK report holds: its items, and the hooks that failed (the tests after a failed hook never ran). */
export interface IKitDocument {
  readonly items: IKitItem[];
  readonly failedHooks: string[];
}

const PASSED_STATE = 'passed';
const FAILED_STATE = 'failed';
const UNNAMED_FAILURE = 'Newman failure with no item';

const MochaTestSchema = z.object({
  title: z.string(),
  fullTitle: z.string().optional(),
  state: z.string().optional(),
  fail: z.boolean().optional(),
  pending: z.boolean().optional(),
  skipped: z.boolean().optional(),
  isHook: z.boolean().optional(),
});

const MochaSuiteSchema = z.object({
  tests: z.array(MochaTestSchema).optional(),
  beforeHooks: z.array(z.unknown()).optional(),
  afterHooks: z.array(z.unknown()).optional(),
  get suites() {
    return z.array(MochaSuiteSchema).optional();
  },
});

const MochaReportSchema = z.object({ results: z.array(MochaSuiteSchema) });

const NewmanAssertionSchema = z.object({
  skipped: z.boolean().optional(),
  error: z.unknown().optional(),
});

const NewmanExecutionSchema = z.object({
  item: z.object({ name: z.string() }),
  response: z.unknown().optional(),
  requestError: z.unknown().optional(),
  assertions: z.array(NewmanAssertionSchema).optional(),
});

const NewmanFailureSchema = z.object({ source: z.object({ name: z.string().optional() }).optional() });

const NewmanReportSchema = z.object({
  run: z.object({ executions: z.array(NewmanExecutionSchema), failures: z.array(NewmanFailureSchema).optional() }),
});

type MochaTest = z.infer<typeof MochaTestSchema>;
type MochaSuite = z.infer<typeof MochaSuiteSchema>;
type NewmanExecution = z.infer<typeof NewmanExecutionSchema>;
type NewmanFailure = z.infer<typeof NewmanFailureSchema>;

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function mochaItemOf(test: MochaTest): IKitItem {
  const ran = test.state === PASSED_STATE;
  const unmarked = test.fail !== true && test.pending !== true && test.skipped !== true;
  return { identifier: normalizeIdentifier(test.fullTitle ?? test.title), passed: ran && unmarked };
}

function mochaItemsOf(suite: MochaSuite): IKitItem[] {
  const own = (suite.tests ?? []).filter((test) => test.isHook !== true).map(mochaItemOf);
  return [...own, ...(suite.suites ?? []).flatMap(mochaItemsOf)];
}

function hookFailed(hook: MochaTest): boolean {
  return hook.state === FAILED_STATE || hook.fail === true;
}

function titleOf(hook: MochaTest): string {
  return normalizeIdentifier(hook.fullTitle ?? hook.title);
}

/** The hooks listed apart (`beforeHooks`, `afterHooks`) and the ones that came among the tests (`isHook`). */
function mochaFailedHooksOf(suite: MochaSuite): string[] {
  const listed = [...(suite.beforeHooks ?? []), ...(suite.afterHooks ?? [])].flatMap((hook) => {
    const parsed = MochaTestSchema.safeParse(hook);
    return parsed.success ? [parsed.data] : [];
  });
  const among = (suite.tests ?? []).filter((test) => test.isHook === true);
  return [...listed, ...among]
    .filter(hookFailed)
    .map(titleOf)
    .concat((suite.suites ?? []).flatMap(mochaFailedHooksOf));
}

function newmanItemOf(execution: NewmanExecution): IKitItem {
  const answered = isPresent(execution.response) && !isPresent(execution.requestError);
  const assertionsPassed = (execution.assertions ?? []).every(
    (assertion) => assertion.skipped !== true && !isPresent(assertion.error),
  );
  return { identifier: normalizeIdentifier(execution.item.name), passed: answered && assertionsPassed };
}

function newmanFailureItemOf(failure: NewmanFailure): IKitItem {
  const name = failure.source?.name;
  return { identifier: name === undefined ? UNNAMED_FAILURE : normalizeIdentifier(name), passed: false };
}

/**
 * Reads one parsed CTK report, Mocha or Newman. A document of another shape holds nothing. A failed Mocha hook is
 * reported apart, because the tests after it never ran. A failure that Newman lists in `run.failures` is a failed
 * item, even when the assertions of its execution passed.
 */
export function readDocument(document: unknown): IKitDocument {
  const mocha = MochaReportSchema.safeParse(document);
  if (mocha.success) {
    return {
      items: mocha.data.results.flatMap(mochaItemsOf),
      failedHooks: mocha.data.results.flatMap(mochaFailedHooksOf),
    };
  }
  const newman = NewmanReportSchema.safeParse(document);
  if (!newman.success) {
    return { items: [], failedHooks: [] };
  }
  const { executions, failures = [] } = newman.data.run;
  return { items: [...executions.map(newmanItemOf), ...failures.map(newmanFailureItemOf)], failedHooks: [] };
}
