import { join, resolve } from 'node:path';
import { z } from 'zod';
import { RESULT_FAILED, RESULT_NOT_RUN, RESULT_PASSED, type LayerResult } from '../report/record.js';
import { describeError } from '../shared/errors.js';
import type { Environment, ICommand, ICommandRunner, IFiles } from '../shared/ports.js';

const SUCCESS_EXIT_CODE = 0;
const PASSED_ASSERTION = 'passed';
const DIRECTORY_PREFIX = 'conformance-kit-tests-';
const REPORT_FILE = 'vitest-report.json';
const OPTION_MARK = '-';

const VitestReportSchema = z.looseObject({
  success: z.boolean(),
  numTotalTests: z.number(),
  testResults: z.array(
    z.looseObject({ name: z.string(), assertionResults: z.array(z.looseObject({ status: z.string() })) }),
  ),
});

type VitestReport = z.output<typeof VitestReportSchema>;

export interface ITestLayersInput {
  readonly pinnedCopyTests: readonly string[];
  readonly answerValidationTests: readonly string[];
  readonly moduleDirectory: string;
  /** The environment the tests get. The caller has already taken the CONFORMANCE_* variables out of it. */
  readonly environment: Environment;
  readonly timeoutMillis: number;
  readonly signal: AbortSignal;
}

export interface ITestLayersEffects {
  readonly runner: ICommandRunner;
  readonly files: IFiles;
  readonly log: (message: string) => void;
  readonly temporaryDirectory: string;
}

export interface ITestLayerResults {
  readonly pinnedCopyIdentity: LayerResult;
  readonly answerValidation: LayerResult;
}

interface ILayer {
  readonly name: string;
  readonly tests: readonly string[];
}

function vitestCommand(input: ITestLayersInput, layer: ILayer, reportPath: string): ICommand {
  const reporters = ['--reporter=default', '--reporter=json', `--outputFile.json=${reportPath}`];
  return {
    program: 'pnpm',
    args: ['exec', 'vitest', 'run', ...reporters, ...layer.tests],
    cwd: input.moduleDirectory,
    env: input.environment,
    interruptible: true,
    timeoutMillis: input.timeoutMillis,
  };
}

function problemOf(report: VitestReport, input: ITestLayersInput, layer: ILayer): string | undefined {
  if (report.numTotalTests === 0) {
    return `the ${layer.name} ran no test`;
  }
  if (!report.success) {
    return `the ${layer.name} has a failing test`;
  }
  const passing = report.testResults
    .filter(
      (file) =>
        file.assertionResults.length > 0 && file.assertionResults.every((one) => one.status === PASSED_ASSERTION),
    )
    .map((file) => resolve(file.name));
  const missing = layer.tests.filter((test) => !passing.includes(resolve(input.moduleDirectory, test)));
  return missing.length === 0 ? undefined : `the ${layer.name} left no passing result for ${missing.join(', ')}`;
}

async function readReport(files: IFiles, path: string): Promise<VitestReport | string> {
  if (!(await files.exists(path))) {
    return 'vitest left no report';
  }
  try {
    return VitestReportSchema.parse(JSON.parse(await files.readText(path)));
  } catch (error) {
    return `the report of vitest cannot be read: ${describeError(error)}`;
  }
}

async function judgeLayer(effects: ITestLayersEffects, input: ITestLayersInput, layer: ILayer): Promise<LayerResult> {
  const directory = await effects.files.makePrivateDirectory(join(effects.temporaryDirectory, DIRECTORY_PREFIX));
  try {
    const reportPath = join(directory, REPORT_FILE);
    const result = await effects.runner.run(vitestCommand(input, layer, reportPath));
    if (input.signal.aborted) {
      return RESULT_NOT_RUN;
    }
    const report = await readReport(effects.files, reportPath);
    const problem =
      typeof report === 'string'
        ? report
        : (problemOf(report, input, layer) ??
          (result.exitCode === SUCCESS_EXIT_CODE ? undefined : `vitest exited with status ${String(result.exitCode)}`));
    if (problem !== undefined) {
      effects.log(`the ${layer.name} failed: ${problem}`);
    }
    return problem === undefined ? RESULT_PASSED : RESULT_FAILED;
  } finally {
    await effects.files.removeTree(directory);
  }
}

async function runLayer(effects: ITestLayersEffects, input: ITestLayersInput, layer: ILayer): Promise<LayerResult> {
  if (input.signal.aborted) {
    return RESULT_NOT_RUN;
  }
  if (layer.tests.length === 0 || layer.tests.some((test) => test === '' || test.startsWith(OPTION_MARK))) {
    effects.log(`the ${layer.name} lists no test file, or a name that is not a file`);
    return RESULT_FAILED;
  }
  try {
    return await judgeLayer(effects, input, layer);
  } catch (error) {
    effects.log(`the ${layer.name} could not be run: ${describeError(error)}`);
    return RESULT_FAILED;
  }
}

/** Layers 1 and 3 (CNF-01, CNF-03): the module's own tests, run with vitest. A set with no test counts as a failure. */
export async function runTestLayers(effects: ITestLayersEffects, input: ITestLayersInput): Promise<ITestLayerResults> {
  const pinnedCopyIdentity = await runLayer(effects, input, {
    name: 'pinned copy check',
    tests: input.pinnedCopyTests,
  });
  const answerValidation = await runLayer(effects, input, {
    name: 'answer validation',
    tests: input.answerValidationTests,
  });
  return { pinnedCopyIdentity, answerValidation };
}
