import { describe, expect, it } from 'vitest';
import { runWith } from '../../src/run/run.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import {
  AUTHORIZATION,
  CONTAINER,
  KIT_DIRECTORY,
  projectDirectoryOf,
  reportWithFailure,
} from '../support/ctk-world.js';
import { failed } from '../support/fake-runner.js';
import { processModule, standIn } from '../support/module-world.js';
import { baseDocument, without } from '../support/oas-documents.js';
import {
  ANSWER_TEST,
  ENVIRONMENT_SENTINEL,
  PINNED_TEST,
  REPORT_PATH,
  kitApi,
  runWorld,
  validEnvironment,
  type IRunWorldOptions,
} from '../support/run-world.js';

const execute = async (options: IRunWorldOptions = {}) => {
  const world = runWorld(options);
  const code = await runWith(world.effects, world.run, world.controller.signal);
  return { ...world, code, report: world.reportOf() };
};

const RESULTS_PASSED = {
  pinnedCopyIdentity: 'passed',
  publishedDocumentComparison: 'passed',
  answerValidation: 'passed',
  conformanceKit: 'passed',
};

const NOT_RUN = {
  pinnedCopyIdentity: 'not-run',
  publishedDocumentComparison: 'not-run',
  answerValidation: 'not-run',
  conformanceKit: 'not-run',
};

describe('a run in which everything passes', () => {
  it('exits with 0 and records the four layers as passed', async () => {
    const { code, report } = await execute();
    expect(code).toBe(0);
    expect(report).toMatchObject({
      api: 'TMF999',
      openapiVersion: '1.0.0',
      results: RESULTS_PASSED,
      deviationsApplied: [],
    });
  });

  it('logs the result of each layer, the kit included', async () => {
    const { log } = await execute();
    expect(log).toEqual(
      expect.arrayContaining([
        'pinned copy identity: passed',
        'published document comparison: passed',
        'answer validation: passed',
        'conformance kit: passed',
      ]),
    );
  });

  it('records the date as an ISO 8601 instant', async () => {
    const { report } = await execute();
    expect(new Date(String(report?.['date'])).toISOString()).toBe(report?.['date']);
  });

  it('runs layers 1 to 3 before the kit', async () => {
    const { runner } = await execute();
    const lines = runner.lines();
    const lastTests = lines.findLastIndex((line) => line.startsWith('pnpm exec vitest'));
    expect(lines.findIndex((line) => line.startsWith('pnpm exec vitest'))).toBe(0);
    expect(lines.indexOf('docker info')).toBeGreaterThan(lastTests);
  });

  it('removes everything it started and leaves the kit folder as it was', async () => {
    const { runner, files, spawned } = await execute();
    expect(spawned[0]?.child.signals).toEqual(['SIGTERM']);
    expect(runner.lines().some((line) => line.includes('network rm'))).toBe(false);
    expect([...files.entries.keys()].filter((path) => path.startsWith('/tmp/'))).toEqual([]);
  });
});

describe('the layers before the kit', () => {
  it('does not stop at a layer that fails: the others and the kit still run, and the exit code reflects the kit only', async () => {
    const { code, report } = await execute({ failingTests: [PINNED_TEST] });
    expect(report?.['results']).toEqual({ ...RESULTS_PASSED, pinnedCopyIdentity: 'failed' });
    expect(code).toBe(0);
  });

  it('records the layer of the answers as failed, and goes on, when its set has no test', async () => {
    const { report, code } = await execute({ api: { answerValidationTests: [] } });
    expect(report?.['results']).toEqual({ ...RESULTS_PASSED, answerValidation: 'failed' });
    expect(code).toBe(0);
  });

  it('records the comparison as failed, and goes on, when the published document differs', async () => {
    const generated = without(baseDocument(), ['paths', '/product'], 'post');
    const { report, code } = await execute({ generated: async () => generated });
    expect(report?.['results']).toEqual({ ...RESULTS_PASSED, publishedDocumentComparison: 'failed' });
    expect(code).toBe(0);
  });

  it('records the comparison as failed, and goes on, when the published document cannot be produced', async () => {
    const { report, log } = await execute({
      generated: async () => Promise.reject(new Error('the app did not start')),
    });
    expect(report?.['results']).toMatchObject({ publishedDocumentComparison: 'failed', conformanceKit: 'passed' });
    expect(log.join('\n')).toContain('the app did not start');
  });

  it('hands the tests the environment without any CONFORMANCE_ variable', async () => {
    const { runner } = await execute();
    const tests = runner.calls.filter((call) => call.program === 'pnpm');
    expect(tests).toHaveLength(2);
    for (const call of tests) {
      expect(call.env).toEqual({ PATH: '/bin', SOME_MODULE_VARIABLE: ENVIRONMENT_SENTINEL });
    }
  });
});

describe('the exit codes of a run', () => {
  it('is 4 when the kit reports a failed item that no deviation excludes, with the layer failed', async () => {
    const { code, report, log } = await execute({
      kitReport: reportWithFailure('POST /thing returns 201'),
      kitExit: 1,
    });
    expect(code).toBe(4);
    expect(report?.['results']).toEqual({ ...RESULTS_PASSED, conformanceKit: 'failed' });
    expect(log.join('\n')).toContain('POST /thing returns 201');
  });

  it('is 0 when the failed item is excluded by a deviation, and the report names the deviation', async () => {
    const { code, report } = await execute({
      kitReport: reportWithFailure('POST /thing returns 201'),
      kitExit: 1,
      deviations: { 'constraints/tmf999-no-create': 'Excludes `POST /thing returns 201`.' },
    });
    expect(code).toBe(0);
    expect(report?.['results']).toEqual(RESULTS_PASSED);
    expect(report?.['deviationsApplied']).toEqual(['constraints/tmf999-no-create']);
  });

  it('excludes a failed item whose real title spans lines, when the deviation cites it on one line', async () => {
    const title = 'POST /thing returns 201 \n\n\t\tEndPoint: http://x:9137/api';
    const { code, report } = await execute({
      kitReport: reportWithFailure(title),
      kitExit: 1,
      deviations: { 'constraints/tmf999-no-create': 'Excludes `POST /thing returns 201 EndPoint: http://x:9137/api`.' },
    });
    expect(code).toBe(0);
    expect(report?.['deviationsApplied']).toEqual(['constraints/tmf999-no-create']);
  });

  it('names a deviation that covered a difference of the published document', async () => {
    const generated = without(baseDocument(), ['paths', '/product'], 'post');
    const { code, report } = await execute({
      generated: async () => generated,
      deviations: { 'constraints/tmf999-no-post': 'Covers "/paths/~1product/post".' },
    });
    expect(code).toBe(0);
    expect(report?.['results']).toEqual(RESULTS_PASSED);
    expect(report?.['deviationsApplied']).toEqual(['constraints/tmf999-no-post']);
  });

  it('does not name a deviation that nothing needed', async () => {
    const { report } = await execute({ deviations: { 'constraints/tmf999-idle': 'Excludes `an item that passed`.' } });
    expect(report?.['deviationsApplied']).toEqual([]);
  });

  it('is 1 when the docker daemon does not answer, with the layers kept and the kit not-run', async () => {
    const { code, report, spawned } = await execute({
      handlers: [(_c, line) => (line === 'docker info' ? failed(1) : undefined)],
    });
    expect(code).toBe(1);
    expect(report?.['results']).toEqual({ ...RESULTS_PASSED, conformanceKit: 'not-run' });
    expect(spawned).toHaveLength(0);
  });

  it('is 1 when the module never answers, and the module is stopped', async () => {
    const { code, report, spawned } = await execute({ probe: [404] });
    expect(code).toBe(1);
    expect(report?.['results']).toMatchObject({ conformanceKit: 'not-run' });
    expect(spawned[0]?.child.signals).toEqual(['SIGTERM']);
  });

  it('is 1 when the kit writes no report', async () => {
    const { code, report } = await execute({ kitReport: undefined });
    expect(code).toBe(1);
    expect(report?.['results']).toMatchObject({ conformanceKit: 'not-run' });
  });

  it('is 1 when something unexpected goes wrong while the module starts', async () => {
    const broken = { start: async () => Promise.reject(new TypeError('unforeseen')) };
    const { code } = await execute({ api: { module: processModule({ standIns: [broken] }) } });
    expect(code).toBe(1);
  });

  it('is 3, with the kit passed in the report, when something the run started cannot be removed', async () => {
    const { code, report } = await execute({
      containerListing: 'deadbeef\n',
      handlers: [(_c, line) => (line.startsWith('docker rm -f') ? failed(1) : undefined)],
    });
    expect(code).toBe(3);
    expect(report?.['results']).toEqual(RESULTS_PASSED);
  });

  it('is 3 rather than 4 when a teardown fails and an item failed', async () => {
    const { code } = await execute({
      kitReport: reportWithFailure('x'),
      kitExit: 1,
      containerListing: 'deadbeef\n',
      handlers: [(_c, line) => (line.startsWith('docker rm -f') ? failed(1) : undefined)],
    });
    expect(code).toBe(3);
  });

  it('is 5 when the report cannot be written and nothing else went wrong', async () => {
    const world = runWorld();
    world.files.failOn('writeText', 'conformance-report');
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(5);
    expect(world.log.join('\n')).toMatch(/report could not be written/);
  });

  it('is 4 rather than 5 when an item failed and the report cannot be written', async () => {
    const world = runWorld({ kitReport: reportWithFailure('x'), kitExit: 1 });
    world.files.failOn('writeText', 'conformance-report');
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(4);
  });
});

describe('a configuration that is refused', () => {
  const refused = async (options: IRunWorldOptions) => {
    const outcome = await execute(options);
    expect(outcome.code).toBe(2);
    expect(outcome.report).toMatchObject({ api: 'TMF999', results: NOT_RUN, deviationsApplied: [] });
    expect(outcome.runner.calls).toHaveLength(0);
    expect(outcome.spawned).toHaveLength(0);
    return outcome;
  };

  it('exits with 2 and records every layer as not-run, with no command run, when a variable is absent', async () => {
    const { PATH, CONFORMANCE_SERVICE_URL: _omitted, ...incomplete } = validEnvironment();
    const { log } = await refused({ environment: { PATH, ...incomplete } });
    expect(log.join('\n')).toContain('CONFORMANCE_SERVICE_URL');
  });

  it('does the same when the folder of the kit is not the one expected', async () => {
    await refused({ environment: { ...validEnvironment(), CONFORMANCE_KIT_DIRECTORY: '/tmp/copy/tmf999' } });
  });

  it('does the same when a deviation node cannot be read', async () => {
    const world = runWorld({ deviations: { 'constraints/tmf999-broken': 'x' } });
    world.files.entries.delete('/spec/constraints/tmf999-broken.md');
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(2);
    expect(world.reportOf()?.['results']).toEqual(NOT_RUN);
    expect(world.runner.calls).toHaveLength(0);
  });

  it('does the same when a deviation node is written in a form the reader refuses', async () => {
    await refused({ deviations: { 'constraints/tmf999-quoted': '"quoted"' } });
  });

  it('stays 2, the first code of the precedence, when it also cannot write the report', async () => {
    const world = runWorld({ environment: {} });
    world.files.failOn('writeText', 'conformance-report');
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(2);
  });
});

describe('an interruption', () => {
  it('stops the run with 1 when the signal comes while the kit runs, tears everything down, and records the kit as not-run', async () => {
    const world = runWorld({
      containerListing: 'deadbeef\n',
      handlers: [
        (command, line) => {
          if (line.includes(' run -T --rm --name ') && command.interruptible) {
            world.controller.abort(new KitDidNotRunError('interrupted by SIGINT'));
            return failed(130);
          }
          return undefined;
        },
      ],
    });
    const code = await runWith(world.effects, world.run, world.controller.signal);
    expect(code).toBe(1);
    expect(world.reportOf()?.['results']).toEqual({ ...RESULTS_PASSED, conformanceKit: 'not-run' });
    expect(world.runner.lines()).toContain(`docker rm -f ${CONTAINER}`);
    expect(world.spawned[0]?.child.signals).toEqual(['SIGTERM']);
  });

  it('exits with 1 and records every layer as not-run when the signal came before anything started', async () => {
    const world = runWorld();
    world.controller.abort(new KitDidNotRunError('interrupted by SIGTERM'));
    const code = await runWith(world.effects, world.run, world.controller.signal);
    expect(code).toBe(1);
    expect(world.reportOf()?.['results']).toEqual(NOT_RUN);
    expect(world.runner.calls).toHaveLength(0);
  });

  it('records a layer that ended with the interruption as not-run', async () => {
    const world = runWorld({
      handlers: [
        (command) => {
          if (command.program === 'pnpm') {
            world.controller.abort(new KitDidNotRunError('interrupted by SIGINT'));
            return failed(130);
          }
          return undefined;
        },
      ],
    });
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(1);
    expect(world.reportOf()?.['results']).toEqual(NOT_RUN);
  });
});

describe('where the report goes', () => {
  it('is conformance-report.json for a module with one API', async () => {
    const { files } = await execute();
    expect(files.textOf(REPORT_PATH)).toBeDefined();
  });

  it('writes the report as the strict format of the standard, and nothing else', async () => {
    const { report } = await execute();
    expect(Object.keys(report ?? {}).toSorted()).toEqual([
      'api',
      'date',
      'deviationsApplied',
      'openapiVersion',
      'results',
    ]);
  });
});

describe('an API without a kit in tmforum', () => {
  const NO_KIT_ENVIRONMENT = { PATH: '/bin' };

  it('runs layers 1 to 3, runs no kit, needs no variable of the kit and exits with 0', async () => {
    const { code, report, runner, spawned } = await execute({ withoutKit: true, environment: NO_KIT_ENVIRONMENT });
    expect(code).toBe(0);
    expect(report?.['results']).toEqual({ ...RESULTS_PASSED, conformanceKit: 'not-applicable' });
    expect(runner.lines().every((line) => line.startsWith('pnpm exec vitest'))).toBe(true);
    expect(spawned).toHaveLength(0);
  });

  it('still records a failed layer, and still exits with 0, because the layers do not change the exit code', async () => {
    const { code, report } = await execute({
      withoutKit: true,
      environment: NO_KIT_ENVIRONMENT,
      failingTests: [PINNED_TEST],
    });
    expect(code).toBe(0);
    expect(report?.['results']).toEqual({
      ...RESULTS_PASSED,
      pinnedCopyIdentity: 'failed',
      conformanceKit: 'not-applicable',
    });
  });

  it('exits with 5 when the report cannot be written', async () => {
    const world = runWorld({ withoutKit: true, environment: NO_KIT_ENVIRONMENT });
    world.files.failOn('writeText', 'conformance-report');
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(5);
  });

  it('exits with 2 and records not-run, not not-applicable, when a timeout is refused', async () => {
    const { code, report } = await execute({
      withoutKit: true,
      environment: { ...NO_KIT_ENVIRONMENT, CONFORMANCE_RUN_TIMEOUT_MS: 'soon' },
    });
    expect(code).toBe(2);
    expect(report?.['results']).toEqual(NOT_RUN);
  });

  it('exits with 1 when the run was interrupted, with the kit still not-applicable', async () => {
    const world = runWorld({ withoutKit: true, environment: NO_KIT_ENVIRONMENT });
    world.controller.abort(new KitDidNotRunError('interrupted by SIGINT'));
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(1);
    expect(world.reportOf()?.['results']).toEqual({ ...NOT_RUN, conformanceKit: 'not-applicable' });
  });
});

describe('a module with several APIs', () => {
  const environmentFor = (code: string, directory: string) => {
    const { CONFORMANCE_KIT_DIRECTORY: _single, ...rest } = validEnvironment();
    return { ...rest, [`CONFORMANCE_KIT_DIRECTORY_${code}`]: directory };
  };
  const several = (extra: Partial<IRunWorldOptions> = {}): IRunWorldOptions => ({
    extraApis: [kitApi('TMF998', 'tmf998-v1.0.0-ctk-1.0.0')],
    environment: environmentFor('TMF999', KIT_DIRECTORY),
    ...extra,
  });

  it('runs the API whose code it is given, however the code is written, and writes its report with the code in the name', async () => {
    const { code, files } = await execute(several({ apiCode: 'tmf999' }));
    expect(code).toBe(0);
    expect(files.textOf('/backend/conformance-report.tmf999.json')).toBeDefined();
    expect(files.textOf(REPORT_PATH)).toBeUndefined();
    expect(files.textOf('/backend/conformance-report.tmf998.json')).toBeUndefined();
  });

  it('takes the folder of the kit from the variable of the API, and ignores the single one', async () => {
    const environment = { ...environmentFor('TMF999', KIT_DIRECTORY), CONFORMANCE_KIT_DIRECTORY: '/elsewhere' };
    const { code } = await execute(several({ apiCode: 'TMF999', environment }));
    expect(code).toBe(0);
  });

  it('refuses, with 2, the folder of the kit of the other API in the variable of this one', async () => {
    const environment = environmentFor('TMF999', '/tmforum/tmf998-v1.0.0-ctk-1.0.0');
    const { code, files, runner } = await execute(several({ apiCode: 'TMF999', environment }));
    expect(code).toBe(2);
    expect(JSON.parse(files.textOf('/backend/conformance-report.tmf999.json') ?? '{}').results).toEqual(NOT_RUN);
    expect(runner.calls).toHaveLength(0);
  });

  it('names the variable of the API when it is absent', async () => {
    const { code, log } = await execute(several({ apiCode: 'TMF999', environment: { PATH: '/bin' } }));
    expect(code).toBe(2);
    expect(log.join('\n')).toContain('CONFORMANCE_KIT_DIRECTORY_TMF999');
  });

  it('refuses, with 2 and no report, a run that names no API', async () => {
    const { code, files, runner, log } = await execute(several());
    expect(code).toBe(2);
    expect(runner.calls).toHaveLength(0);
    expect([...files.entries.keys()].filter((path) => path.includes('conformance-report'))).toEqual([]);
    expect(log.join('\n')).toMatch(/TMF999, TMF998/);
  });

  it('refuses, with 2 and no report, a code that no API has', async () => {
    const { code, files, log } = await execute(several({ apiCode: 'tmf000' }));
    expect(code).toBe(2);
    expect([...files.entries.keys()].filter((path) => path.includes('conformance-report'))).toEqual([]);
    expect(log.join('\n')).toContain('TMF000');
  });
});

describe('a module with one API', () => {
  it('runs without a code, and writes conformance-report.json', async () => {
    const { code, files } = await execute();
    expect(code).toBe(0);
    expect(files.textOf(REPORT_PATH)).toBeDefined();
  });

  it('accepts its own code, in any case', async () => {
    expect((await execute({ apiCode: 'tmf999' })).code).toBe(0);
  });

  it('refuses, with 2, a code that is not its own', async () => {
    const { code, runner } = await execute({ apiCode: 'tmf632' });
    expect(code).toBe(2);
    expect(runner.calls).toHaveLength(0);
  });
});

describe('the config.json of the kit', () => {
  it.each([
    ['is not JSON', 'not json'],
    ['has no url', '{"headers": {}}'],
    ['has a url that is not http', '{"url": "ftp://x/api"}'],
  ])('refuses the run with 2, and records every layer as not-run, when it %s', async (_name, text) => {
    const world = runWorld();
    world.files.seed(`${KIT_DIRECTORY}/config.json`, text);
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(2);
    expect(world.reportOf()?.['results']).toEqual(NOT_RUN);
    expect(world.runner.calls).toHaveLength(0);
  });

  it('refuses the run with 2 when the kit folder has no config.json', async () => {
    const world = runWorld();
    world.files.entries.delete(`${KIT_DIRECTORY}/config.json`);
    expect(await runWith(world.effects, world.run, world.controller.signal)).toBe(2);
  });
});

describe('the secrets', () => {
  const holders = (outcome: Awaited<ReturnType<typeof execute>>, secret: string): string[] => [
    ...[...outcome.files.entries]
      .filter(([path]) => !path.endsWith('/config.json') || !path.startsWith('/tmp/'))
      .filter(([, entry]) => entry.text.includes(secret))
      .map(([path]) => path),
    ...(outcome.log.join('\n').includes(secret) ? ['the log'] : []),
    ...(outcome.output.join('').includes(secret) ? ['the output'] : []),
    ...(JSON.stringify(outcome.runner.calls).includes(secret) ? ['a command'] : []),
  ];

  it('never shows the token, in the log, the output, a command or any file but the config.json of the copy', async () => {
    const outcome = await execute();
    expect(holders(outcome, 'top-secret-token-value')).toEqual([]);
    expect(outcome.files.removed.some((path) => path.startsWith('/tmp/'))).toBe(true);
  });

  it('hides the token in a message that a failure of the module or of a stand-in carries', async () => {
    const leaking = { start: async () => Promise.reject(new Error(`could not reach with ${AUTHORIZATION}`)) };
    const outcome = await execute({ api: { module: processModule({ standIns: [leaking] }) } });
    expect(outcome.code).toBe(1);
    expect(holders(outcome, 'top-secret-token-value')).toEqual([]);
    expect(outcome.log.join('\n')).toContain('[redacted]');
  });

  it('hides the token in a message even when the settings are refused', async () => {
    const outcome = await execute({
      environment: { ...validEnvironment(), CONFORMANCE_SERVICE_URL: `${AUTHORIZATION}-not-a-url` },
    });
    expect(outcome.code).toBe(2);
    expect(holders(outcome, 'top-secret-token-value')).toEqual([]);
  });

  it('never shows the value of a variable of the module in the log, the output or the report', async () => {
    const outcome = await execute({ kitReport: reportWithFailure('x'), kitExit: 1 });
    expect(holders(outcome, ENVIRONMENT_SENTINEL).filter((holder) => holder !== 'a command')).toEqual([]);
  });

  it('keeps the token out of the config.json that is not the private copy, and puts it in the copy', async () => {
    const world = runWorld({
      handlers: [
        (command, line) => {
          if (line.includes(' run -T --rm --name ') && !line.includes('--user 0')) {
            const text = world.files.textOf(`${projectDirectoryOf(command)}/config.json`) ?? '';
            expect(text).toContain(AUTHORIZATION);
            expect(world.files.modeOf(`${projectDirectoryOf(command)}/config.json`)).toBe(0o644);
          }
          return undefined;
        },
      ],
    });
    await runWith(world.effects, world.run, world.controller.signal);
    expect(world.files.textOf(`${KIT_DIRECTORY}/config.json`)).not.toContain(AUTHORIZATION);
  });
});

describe('a module run as a compose service', () => {
  const composeApi = {
    module: {
      mode: 'compose',
      directory: '/backend',
      service: 'api-kit',
      kitHost: 'api-kit',
      kitPort: 3000,
      apiBasePath: '/tmf-api/thing/v5',
    },
  } as const;

  it('refuses to start when a service of an earlier run is still up', async () => {
    const { code, report } = await execute({
      api: composeApi,
      handlers: [
        (_c, line) =>
          line.includes(' ps -q') ? { exitCode: 0, output: 'abc\n', stdout: 'abc\n', timedOut: false } : undefined,
      ],
    });
    expect(code).toBe(1);
    expect(report?.['results']).toMatchObject({ conformanceKit: 'not-run' });
  });

  it('runs, with 0, and takes the service down', async () => {
    const { code, runner } = await execute({ api: composeApi });
    expect(code).toBe(0);
    expect(runner.lines().at(-1)).not.toContain('up -d');
    expect(runner.lines().some((line) => line.endsWith('down --remove-orphans'))).toBe(true);
  });
});

describe('the stand-ins', () => {
  it('start before the module and close when the run ends', async () => {
    const events: string[] = [];
    const outcome = await execute({ api: { module: processModule({ standIns: [standIn('catalog', events)] }) } });
    expect(outcome.code).toBe(0);
    expect(events).toEqual(['start:catalog', 'close:catalog']);
  });
});
