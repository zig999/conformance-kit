import { stringify } from 'yaml';
import type { IApiConformance, IApiWithKit, IConformanceRun } from '../../src/run/types.js';
import type { IRunEffects } from '../../src/shared/effects.js';
import type { ICommand } from '../../src/shared/ports.js';
import { AUTHORIZATION, KIT_DIRECTORY, SERVICE_URL, dockerAnswers, seedKit, type IWorldOptions } from './ctk-world.js';
import { CONFORMANCE_NODE, SPECIFICATION_ROOT, conformanceNodeText, nodeText } from './deviation-nodes.js';
import { FakeClock } from './fake-clock.js';
import { childProcesses, createFakeSpawn } from './fake-spawn.js';
import { FakeRunner, succeeded, failed } from './fake-runner.js';
import { MemoryFiles } from './memory-files.js';
import { API_BASE_PATH, processModule, type ProbeAnswer } from './module-world.js';
import { baseDocument } from './oas-documents.js';

export const MODULE_DIRECTORY = '/backend';
export const PINNED_OAS = '/backend/contracts/TMF999-v1.0.0.oas.yaml';
export const REPORT_PATH = '/backend/conformance-report.json';
export const PINNED_TEST = 'tests/contract/pinned-copy.test.ts';
export const ANSWER_TEST = 'tests/contract/answers.test.ts';
export const ENVIRONMENT_SENTINEL = 'sentinel-value-of-a-module-variable';

export interface IRunWorldOptions extends IWorldOptions {
  readonly deviations?: Readonly<Record<string, string>>;
  readonly failingTests?: readonly string[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly api?: Partial<IApiWithKit>;
  readonly extraApis?: readonly IApiConformance[];
  readonly apiCode?: string;
  readonly withoutKit?: boolean;
  readonly probe?: readonly ProbeAnswer[];
  readonly generated?: () => Promise<unknown>;
}

export const validEnvironment = (): Record<string, string> => ({
  PATH: '/bin',
  SOME_MODULE_VARIABLE: ENVIRONMENT_SENTINEL,
  CONFORMANCE_SERVICE_URL: SERVICE_URL,
  CONFORMANCE_ACCESS_TOKEN: AUTHORIZATION,
  CONFORMANCE_KIT_DIRECTORY: KIT_DIRECTORY,
});

const vitestReport = (tests: readonly string[], failing: readonly string[]): string =>
  JSON.stringify({
    success: !tests.some((test) => failing.includes(test)),
    numTotalTests: tests.length,
    testResults: tests.map((test) => ({
      name: `${MODULE_DIRECTORY}/${test}`,
      assertionResults: [{ status: failing.includes(test) ? 'failed' : 'passed' }],
    })),
  });

export const kitApi = (
  code: string,
  folder: string,
  generated: () => Promise<unknown> = async () => baseDocument(),
): IApiWithKit => ({
  api: code,
  openapiVersion: '1.0.0',
  pinnedOas: PINNED_OAS,
  generatedOas: generated,
  pinnedCopyTests: [PINNED_TEST],
  answerValidationTests: [ANSWER_TEST],
  conformanceNode: CONFORMANCE_NODE,
  specificationRoot: SPECIFICATION_ROOT,
  kit: { tmforumDirectory: '/tmforum', folder },
  module: processModule({ apiBasePath: API_BASE_PATH }),
});

export const withoutKitOf = (api: IApiWithKit): IApiConformance => ({
  api: api.api,
  openapiVersion: api.openapiVersion,
  pinnedOas: api.pinnedOas,
  generatedOas: api.generatedOas,
  pinnedCopyTests: api.pinnedCopyTests,
  answerValidationTests: api.answerValidationTests,
  conformanceNode: api.conformanceNode,
  specificationRoot: api.specificationRoot,
  withoutKit: true,
});

export function runWorld(options: IRunWorldOptions = {}) {
  const deviations = options.deviations ?? {};
  const files = seedKit(new MemoryFiles())
    .seed(`${SPECIFICATION_ROOT}/${CONFORMANCE_NODE}.md`, conformanceNodeText(...Object.keys(deviations)))
    .seed(PINNED_OAS, stringify(baseDocument()));
  Object.entries(deviations).forEach(([node, statement]) =>
    files.seed(`${SPECIFICATION_ROOT}/${node}.md`, nodeText(`statement: ${statement}`)),
  );
  const docker = dockerAnswers(files, options);
  const runner = new FakeRunner(async (command: ICommand) => {
    for (const handler of options.handlers ?? []) {
      const answered = await handler(command, [command.program, ...command.args].join(' '));
      if (answered !== undefined) {
        return answered;
      }
    }
    if (command.program !== 'pnpm') {
      return docker(command);
    }
    const tests = command.args.filter((argument) => argument.startsWith('tests/'));
    const outputFile = command.args.find((argument) => argument.startsWith('--outputFile.json='));
    const failing = options.failingTests ?? [];
    await files.writeText(outputFile?.slice('--outputFile.json='.length) ?? '', vitestReport(tests, failing));
    return failing.some((test) => tests.includes(test)) ? failed(1) : succeeded();
  });
  const log: string[] = [];
  const output: string[] = [];
  const clock = new FakeClock();
  const answers = [...(options.probe ?? [200])];
  const spawning = createFakeSpawn(() => undefined);
  const effects: IRunEffects = {
    runner,
    files,
    clock,
    log: (message) => log.push(message),
    randomId: () => 'a1b2c3',
    temporaryDirectory: '/tmp',
    spawn: spawning.spawn,
    processes: childProcesses,
    portIsFree: async () => true,
    probe: {
      status: async () => {
        const answer = answers.length > 1 ? answers.shift() : answers[0];
        if (answer === 'down' || answer === undefined) {
          throw new Error('nothing answers');
        }
        return answer;
      },
    },
  };
  const withKit: IApiWithKit = {
    ...kitApi('TMF999', 'tmf999-v1.0.0-ctk-1.0.0', options.generated),
    ...options.api,
  };
  const api: IApiConformance = options.withoutKit === true ? withoutKitOf(withKit) : withKit;
  const run: IConformanceRun = {
    environment: options.environment ?? validEnvironment(),
    moduleDirectory: MODULE_DIRECTORY,
    apis: [api, ...(options.extraApis ?? [])],
    ...(options.apiCode === undefined ? {} : { apiCode: options.apiCode }),
    log: () => undefined,
    output: (chunk) => output.push(chunk),
  };
  const controller = new AbortController();
  return {
    files,
    runner,
    effects,
    run,
    log,
    output,
    clock,
    spawned: spawning.spawned,
    controller,
    reportOf: (path = REPORT_PATH): Record<string, unknown> | undefined => {
      const text = files.textOf(path);
      return text === undefined ? undefined : JSON.parse(text);
    },
  };
}
