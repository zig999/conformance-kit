export interface IMochaTest {
  readonly title: string;
  readonly fullTitle?: string;
  readonly state?: string;
  readonly fail?: boolean;
  readonly pending?: boolean;
  readonly skipped?: boolean;
  readonly isHook?: boolean;
}

export interface IMochaSuite {
  readonly tests?: readonly IMochaTest[];
  readonly suites?: readonly IMochaSuite[];
  readonly beforeHooks?: readonly unknown[];
  readonly afterHooks?: readonly unknown[];
}

export interface IMochaStats {
  readonly tests: number;
  readonly passes: number;
  readonly failures: number;
  readonly testsRegistered: number;
}

const isPassed = (test: IMochaTest): boolean =>
  test.state === 'passed' && test.fail !== true && test.pending !== true && test.skipped !== true;

const testsOf = (suite: IMochaSuite): IMochaTest[] => [
  ...(suite.tests ?? []).filter((test) => test.isHook !== true),
  ...(suite.suites ?? []).flatMap(testsOf),
];

/** The totals that mochawesome writes in `stats`, worked out from the tests the way the kit counts them. */
export const mochaStatsOf = (suites: readonly IMochaSuite[]): IMochaStats => {
  const tests = suites.flatMap(testsOf);
  return {
    tests: tests.length,
    passes: tests.filter(isPassed).length,
    failures: tests.filter((test) => test.state === 'failed' || test.fail === true).length,
    testsRegistered: tests.length,
  };
};

/** A mochawesome report. `stats` is worked out by default, overridden in part, or left out with `null`. */
export const mochaDocument = (suites: readonly IMochaSuite[], stats: Partial<IMochaStats> | null = {}): string =>
  JSON.stringify({ ...(stats === null ? {} : { stats: { ...mochaStatsOf(suites), ...stats } }), results: suites });

export const passedTest = (fullTitle: string): IMochaTest => ({ title: fullTitle, fullTitle, state: 'passed' });
export const failedTest = (fullTitle: string): IMochaTest => ({
  title: fullTitle,
  fullTitle,
  state: 'failed',
  fail: true,
});

export const mochaReport = (...suites: IMochaSuite[]): string => mochaDocument(suites);

export interface INewmanExecution {
  readonly item: { readonly name: string };
  readonly response?: unknown;
  readonly requestError?: unknown;
  readonly assertions?: readonly { readonly skipped?: boolean; readonly error?: unknown }[];
}

export const answered = (name: string, assertions: INewmanExecution['assertions'] = []): INewmanExecution => ({
  item: { name },
  response: { code: 200 },
  assertions,
});

export interface INewmanStats {
  readonly requests: { readonly total: number };
  readonly assertions: { readonly total: number; readonly failed: number };
}

const assertionsOf = (executions: readonly INewmanExecution[]) =>
  executions.flatMap((execution) => execution.assertions ?? []);

/** The totals of `run.stats`, worked out from the executions the way the kit counts them. */
export const newmanStatsOf = (executions: readonly INewmanExecution[]): INewmanStats => ({
  requests: { total: executions.length },
  assertions: {
    total: assertionsOf(executions).length,
    failed: assertionsOf(executions).filter((assertion) => assertion.error !== undefined && assertion.error !== null)
      .length,
  },
});

export const newmanDocument = (
  executions: readonly INewmanExecution[],
  options: { readonly failures?: readonly unknown[]; readonly stats?: Partial<INewmanStats> | null } = {},
): string => {
  const { failures, stats } = options;
  return JSON.stringify({
    run: {
      executions,
      ...(failures === undefined ? {} : { failures }),
      ...(stats === null ? {} : { stats: { ...newmanStatsOf(executions), ...stats } }),
    },
  });
};

export const newmanReport = (...executions: INewmanExecution[]): string => newmanDocument(executions);
