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
}

export const passedTest = (fullTitle: string): IMochaTest => ({ title: fullTitle, fullTitle, state: 'passed' });
export const failedTest = (fullTitle: string): IMochaTest => ({
  title: fullTitle,
  fullTitle,
  state: 'failed',
  fail: true,
});

export const mochaReport = (...suites: IMochaSuite[]): string => JSON.stringify({ results: suites });

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

export const newmanReport = (...executions: INewmanExecution[]): string => JSON.stringify({ run: { executions } });
