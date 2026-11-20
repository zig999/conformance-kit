import { describe, expect, it } from 'vitest';
import { runTestLayers, type ITestLayersInput } from '../../src/layers/test-layer.js';
import { FakeRunner, failed, succeeded } from '../support/fake-runner.js';
import { MemoryFiles } from '../support/memory-files.js';

const MODULE = '/backend';
const PINNED_TEST = 'tests/contract/pinned-copy.test.ts';
const ANSWER_TESTS = ['tests/contract/answers-a.test.ts', 'tests/contract/answers-b.test.ts'];

interface IVitestReport {
  readonly success: boolean;
  readonly numTotalTests: number;
  readonly files: readonly { readonly name: string; readonly assertions: readonly string[] }[];
}

const reportText = (report: IVitestReport): string =>
  JSON.stringify({
    success: report.success,
    numTotalTests: report.numTotalTests,
    testResults: report.files.map((file) => ({
      name: `${MODULE}/${file.name}`,
      assertionResults: file.assertions.map((status) => ({ status })),
    })),
  });

const passing = (...names: string[]): IVitestReport => ({
  success: true,
  numTotalTests: names.length,
  files: names.map((name) => ({ name, assertions: ['passed'] })),
});

const outputFileOf = (args: readonly string[]): string => {
  const flag = args.find((argument) => argument.startsWith('--outputFile.json='));
  return flag?.slice('--outputFile.json='.length) ?? '';
};

interface IWorld {
  readonly files: MemoryFiles;
  readonly runner: FakeRunner;
  readonly log: string[];
  run(input?: Partial<ITestLayersInput>): ReturnType<typeof runTestLayers>;
}

const world = (answers: (tests: readonly string[]) => { exit: number; report: string | undefined }): IWorld => {
  const files = new MemoryFiles();
  const log: string[] = [];
  const runner = new FakeRunner(async (command) => {
    const tests = command.args.filter((argument) => argument.startsWith('tests/'));
    const answer = answers(tests);
    if (answer.report !== undefined) {
      await files.writeText(outputFileOf(command.args), answer.report);
    }
    return answer.exit === 0 ? succeeded() : failed(answer.exit);
  });
  const input: ITestLayersInput = {
    pinnedCopyTests: [PINNED_TEST],
    answerValidationTests: ANSWER_TESTS,
    moduleDirectory: MODULE,
    environment: { PATH: '/bin' },
    timeoutMillis: 5,
    signal: new AbortController().signal,
  };
  return {
    files,
    runner,
    log,
    run: (override = {}) =>
      runTestLayers(
        { runner, files, log: (message) => log.push(message), temporaryDirectory: '/tmp' },
        { ...input, ...override },
      ),
  };
};

const everythingPasses = (tests: readonly string[]) => ({ exit: 0, report: reportText(passing(...tests)) });

describe('the test layers (layers 1 and 3)', () => {
  it('maps a set that passes to passed, for the pinned copy and for the answers', async () => {
    const { run } = world(everythingPasses);
    expect(await run()).toEqual({ pinnedCopyIdentity: 'passed', answerValidation: 'passed' });
  });

  it('runs the listed files with vitest, in the module directory, with the environment given and no other', async () => {
    const { run, runner } = world(everythingPasses);
    await run();
    expect(runner.calls).toHaveLength(2);
    const [first] = runner.calls;
    expect(first).toMatchObject({
      program: 'pnpm',
      cwd: MODULE,
      env: { PATH: '/bin' },
      interruptible: true,
      timeoutMillis: 5,
    });
    expect(first?.args.slice(0, 3)).toEqual(['exec', 'vitest', 'run']);
    expect(first?.args).toContain(PINNED_TEST);
  });

  it('fails a layer whose set has a failure, and still runs the other layer', async () => {
    const { run } = world((tests) =>
      tests.includes(PINNED_TEST)
        ? {
            exit: 1,
            report: reportText({
              success: false,
              numTotalTests: 1,
              files: [{ name: PINNED_TEST, assertions: ['failed'] }],
            }),
          }
        : everythingPasses(tests),
    );
    expect(await run()).toEqual({ pinnedCopyIdentity: 'failed', answerValidation: 'passed' });
  });

  it('fails a layer whose set has no test at all', async () => {
    const { run, log } = world(() => ({ exit: 0, report: reportText({ success: true, numTotalTests: 0, files: [] }) }));
    expect(await run()).toEqual({ pinnedCopyIdentity: 'failed', answerValidation: 'failed' });
    expect(log.join('\n')).toMatch(/no test/);
  });

  it('fails a layer when the report of vitest is missing', async () => {
    const { run, log } = world(() => ({ exit: 0, report: undefined }));
    expect((await run()).pinnedCopyIdentity).toBe('failed');
    expect(log.join('\n')).toMatch(/report/);
  });

  it('fails a layer when the report of vitest is not readable', async () => {
    const { run } = world(() => ({ exit: 0, report: 'not json' }));
    expect((await run()).answerValidation).toBe('failed');
  });

  it('fails a layer when vitest exits with a failure even though the report says success', async () => {
    const { run } = world((tests) => ({ exit: 1, report: reportText(passing(...tests)) }));
    expect((await run()).pinnedCopyIdentity).toBe('failed');
  });

  it('fails a layer when a listed file left no passing result in the report', async () => {
    const { run, log } = world(() => ({ exit: 0, report: reportText(passing(PINNED_TEST, ANSWER_TESTS[0] ?? '')) }));
    const result = await run();
    expect(result).toEqual({ pinnedCopyIdentity: 'passed', answerValidation: 'failed' });
    expect(log.join('\n')).toContain(ANSWER_TESTS[1]);
  });

  it('fails a layer whose listed file ran no assertion', async () => {
    const empty: IVitestReport = { success: true, numTotalTests: 1, files: [{ name: PINNED_TEST, assertions: [] }] };
    const { run } = world(() => ({ exit: 0, report: reportText(empty) }));
    expect((await run()).pinnedCopyIdentity).toBe('failed');
  });

  it('fails, without running vitest, a layer that lists no file', async () => {
    const { run, runner } = world(everythingPasses);
    expect((await run({ pinnedCopyTests: [] })).pinnedCopyIdentity).toBe('failed');
    expect(runner.calls).toHaveLength(1);
  });

  it('refuses, without running vitest, a listed file that vitest would take for an option', async () => {
    const { run, runner } = world(everythingPasses);
    const result = await run({ pinnedCopyTests: ['--config=other'] });
    expect(result.pinnedCopyIdentity).toBe('failed');
    expect(runner.calls).toHaveLength(1);
  });

  it('leaves both layers not-run when the run was interrupted before they started', async () => {
    const controller = new AbortController();
    controller.abort();
    const { run, runner } = world(everythingPasses);
    expect(await run({ signal: controller.signal })).toEqual({
      pinnedCopyIdentity: 'not-run',
      answerValidation: 'not-run',
    });
    expect(runner.calls).toHaveLength(0);
  });

  it('leaves a layer not-run when the run was interrupted while it ran', async () => {
    const controller = new AbortController();
    const { run } = world(() => {
      controller.abort();
      return { exit: 130, report: undefined };
    });
    expect(await run({ signal: controller.signal })).toEqual({
      pinnedCopyIdentity: 'not-run',
      answerValidation: 'not-run',
    });
  });

  it('removes its working directory, with success and with failure', async () => {
    const { run, files } = world(() => ({ exit: 1, report: undefined }));
    await run();
    expect(files.removed).toHaveLength(2);
    expect(files.directories.size).toBe(0);
  });
});
