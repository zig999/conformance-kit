import { z } from 'zod';
import { normalizeIdentifier } from '../shared/identifier.js';

export interface IKitItem {
  readonly identifier: string;
  readonly passed: boolean;
}

/**
 * What one CTK report holds: its items, the hooks that failed (the tests after them never ran), and what the report
 * says that does not agree with itself. A document that is neither a Mocha nor a Newman report is `unknown`.
 */
export interface IKitDocument {
  readonly kind: 'mocha' | 'newman' | 'unknown';
  readonly items: IKitItem[];
  readonly failedHooks: string[];
  readonly problems: string[];
}

const FAILED_STATE = 'failed';
const UNNAMED_FAILURE = 'Newman failure with no item';
const NO_TOTALS = 'its report holds no totals to check the items against';

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

/** The `stats` of mochawesome, which every report carries and which counts the tests independently of their place. */
const MochaStatsSchema = z.object({
  tests: z.number(),
  passes: z.number(),
  failures: z.number(),
  testsRegistered: z.number().optional(),
});

const MochaReportSchema = z.object({ stats: z.unknown().optional(), results: z.array(MochaSuiteSchema) });

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

const NewmanStatsSchema = z.object({
  requests: z.object({ total: z.number() }),
  assertions: z.object({ total: z.number(), failed: z.number() }),
});

const NewmanReportSchema = z.object({
  run: z.object({
    executions: z.array(NewmanExecutionSchema),
    failures: z.array(NewmanFailureSchema).optional(),
    stats: z.unknown().optional(),
  }),
});

type MochaTest = z.infer<typeof MochaTestSchema>;
type MochaSuite = z.infer<typeof MochaSuiteSchema>;
type NewmanExecution = z.infer<typeof NewmanExecutionSchema>;
type NewmanFailure = z.infer<typeof NewmanFailureSchema>;

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isPassed(test: MochaTest): boolean {
  return test.state === 'passed' && test.fail !== true && test.pending !== true && test.skipped !== true;
}

function isFailed(test: MochaTest): boolean {
  return test.state === FAILED_STATE || test.fail === true;
}

function titleOf(test: MochaTest): string {
  return normalizeIdentifier(test.fullTitle ?? test.title);
}

/** The tests of a suite and of the suites inside it, hooks left out. */
function mochaTestsOf(suite: MochaSuite): MochaTest[] {
  const own = (suite.tests ?? []).filter((test) => test.isHook !== true);
  return [...own, ...(suite.suites ?? []).flatMap(mochaTestsOf)];
}

/** The hooks listed apart (`beforeHooks`, `afterHooks`) and the ones that came among the tests (`isHook`). */
function mochaFailedHooksOf(suite: MochaSuite): string[] {
  const listed = [...(suite.beforeHooks ?? []), ...(suite.afterHooks ?? [])].flatMap((hook) => {
    const parsed = MochaTestSchema.safeParse(hook);
    return parsed.success ? [parsed.data] : [];
  });
  const among = (suite.tests ?? []).filter((test) => test.isHook === true);
  return [...listed, ...among]
    .filter(isFailed)
    .map(titleOf)
    .concat((suite.suites ?? []).flatMap(mochaFailedHooksOf));
}

function mochaProblemsOf(stats: unknown, tests: readonly MochaTest[]): string[] {
  const declared = MochaStatsSchema.safeParse(stats);
  if (!declared.success) {
    return [NO_TOTALS];
  }
  const { tests: total, passes, failures, testsRegistered } = declared.data;
  const problems: string[] = [];
  if (total !== tests.length) {
    problems.push(`it declares ${String(total)} tests and holds ${String(tests.length)}`);
  }
  if (testsRegistered !== undefined && testsRegistered !== tests.length) {
    problems.push(`it registered ${String(testsRegistered)} tests, but ran ${String(tests.length)}`);
  }
  if (passes !== tests.filter(isPassed).length) {
    problems.push(`it declares ${String(passes)} passes and ${String(tests.filter(isPassed).length)} items passed`);
  }
  if (failures !== tests.filter(isFailed).length) {
    problems.push(`it declares ${String(failures)} failures and ${String(tests.filter(isFailed).length)} items failed`);
  }
  return problems;
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

function newmanProblemsOf(stats: unknown, executions: readonly NewmanExecution[]): string[] {
  const declared = NewmanStatsSchema.safeParse(stats);
  if (!declared.success) {
    return [NO_TOTALS];
  }
  const assertions = executions.flatMap((execution) => execution.assertions ?? []);
  const failed = assertions.filter((assertion) => isPresent(assertion.error)).length;
  const problems: string[] = [];
  if (declared.data.requests.total !== executions.length) {
    problems.push(
      `it declares ${String(declared.data.requests.total)} requests and holds ${String(executions.length)}`,
    );
  }
  if (declared.data.assertions.total !== assertions.length) {
    problems.push(
      `it declares ${String(declared.data.assertions.total)} assertions and holds ${String(assertions.length)}`,
    );
  }
  if (declared.data.assertions.failed !== failed) {
    problems.push(
      `it declares ${String(declared.data.assertions.failed)} failed assertions and the items show ${String(failed)}`,
    );
  }
  return problems;
}

/**
 * Reads one parsed CTK report, Mocha or Newman, and checks it against the totals it declares: a report whose items
 * do not add up to its own `stats` is one the kit cannot trust, whatever the cause, and a hook that failed is one
 * whose later tests never ran. A failure that Newman lists in `run.failures` is a failed item. A document of another
 * shape is `unknown`.
 */
export function readDocument(document: unknown): IKitDocument {
  const mocha = MochaReportSchema.safeParse(document);
  if (mocha.success) {
    const tests = mocha.data.results.flatMap(mochaTestsOf);
    return {
      kind: 'mocha',
      items: tests.map((test) => ({ identifier: titleOf(test), passed: isPassed(test) })),
      failedHooks: mocha.data.results.flatMap(mochaFailedHooksOf),
      problems: mochaProblemsOf(mocha.data.stats, tests),
    };
  }
  const newman = NewmanReportSchema.safeParse(document);
  if (!newman.success) {
    return { kind: 'unknown', items: [], failedHooks: [], problems: [] };
  }
  const { executions, failures = [], stats } = newman.data.run;
  return {
    kind: 'newman',
    items: [...executions.map(newmanItemOf), ...failures.map(newmanFailureItemOf)],
    failedHooks: [],
    problems: newmanProblemsOf(stats, executions),
  };
}
