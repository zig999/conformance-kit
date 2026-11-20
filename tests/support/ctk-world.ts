import { readKitItems } from '../../src/ctk/kit-report.js';
import type { ICtkContext, ICtkSettings } from '../../src/ctk/context.js';
import type { ICommand, ICommandResult } from '../../src/shared/ports.js';
import { Teardown } from '../../src/shared/teardown.js';
import { mochaReport, passedTest, failedTest } from './ctk-reports.js';
import { FakeClock } from './fake-clock.js';
import { FakeRunner, failed, succeeded } from './fake-runner.js';
import { MemoryFiles } from './memory-files.js';

export const KIT_DIRECTORY = '/tmforum/tmf999-v1.0.0-ctk-1.0.0';
export const AUTHORIZATION = 'Bearer top-secret-token-value';
export const CTK_HOST = 'tmf999-ri';
export const CTK_PATH = '/tmf-api/thing/v5';
export const UNIQUE_ID = 'a1b2c3';
export const SERVICE_URL = 'http://localhost:9000';
export const CONTAINER = `conformance-ctk-${UNIQUE_ID}`;

export const KIT_CONFIGURATION = JSON.stringify({
  url: `http://${CTK_HOST}:8999${CTK_PATH}`,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  payloads: { Thing: { POST: { payload: { name: 'a thing' } } } },
});

export type Handler = (command: ICommand, line: string) => ICommandResult | Promise<ICommandResult> | undefined;

export interface IWorldOptions {
  readonly networkExists?: boolean;
  readonly kitExit?: number;
  readonly kitReport?: string | undefined;
  readonly containerListing?: string;
  readonly handlers?: readonly Handler[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

export const projectDirectoryOf = (command: ICommand): string => {
  const at = command.args.indexOf('--project-directory');
  return command.args[at + 1] ?? '';
};

export const defaultReport = (): string => mochaReport({ tests: [passedTest('first'), passedTest('second')] });
export const reportWithFailure = (identifier: string): string =>
  mochaReport({ tests: [passedTest('first'), failedTest(identifier)] });

/** What docker answers in a run where everything works, unless the options say otherwise. */
export function dockerAnswers(
  files: MemoryFiles,
  options: IWorldOptions = {},
): (command: ICommand) => Promise<ICommandResult> {
  const kitReport = 'kitReport' in options ? options.kitReport : defaultReport();
  return async (command) => {
    const line = [command.program, ...command.args].join(' ');
    for (const handler of options.handlers ?? []) {
      const answered = await handler(command, line);
      if (answered !== undefined) {
        return answered;
      }
    }
    if (line === 'docker network inspect tmf') {
      return options.networkExists === false ? failed(1) : succeeded();
    }
    if (line.includes(' run -T --rm --name ') && !line.includes('--user 0')) {
      if (kitReport !== undefined) {
        await files.writeText(`${projectDirectoryOf(command)}/reports/report.json`, kitReport);
      }
      return options.kitExit === undefined ? succeeded() : failed(options.kitExit);
    }
    if (line.startsWith('docker ps -a -q --filter')) {
      return succeeded(options.containerListing ?? '');
    }
    return succeeded();
  };
}

export function seedKit(files: MemoryFiles): MemoryFiles {
  return files
    .seed(`${KIT_DIRECTORY}/docker-compose.yaml`, 'services:\n  ctk:\n    image: example\n')
    .seed(`${KIT_DIRECTORY}/.env`, 'HTTP_PROXY=\n')
    .seed(`${KIT_DIRECTORY}/config.json`, KIT_CONFIGURATION);
}

export function ctkWorld(options: IWorldOptions = {}) {
  const files = seedKit(new MemoryFiles());
  const log: string[] = [];
  const runner = new FakeRunner(dockerAnswers(files, options));
  const settings: ICtkSettings = {
    kitDirectory: KIT_DIRECTORY,
    authorization: AUTHORIZATION,
    serviceUrl: SERVICE_URL,
    startTimeoutMillis: 3333,
    runTimeoutMillis: 111,
    stepTimeoutMillis: 22,
    environment: options.environment ?? { PATH: '/bin' },
  };
  const clock = new FakeClock();
  const controller = new AbortController();
  const teardown = new Teardown((message) => log.push(message));
  const context: ICtkContext = {
    effects: {
      runner,
      files,
      clock,
      log: (message) => log.push(message),
      randomId: () => UNIQUE_ID,
      temporaryDirectory: '/tmp',
      spawn: () => {
        throw new Error('no process is expected to start');
      },
      freePort: async () => 5555,
      probe: { status: async () => 200 },
    },
    settings,
    teardown,
    signal: controller.signal,
  };
  return { files, runner, log, clock, context, teardown, interrupt: () => controller.abort(), readKitItems };
}
