import { describe, expect, it } from 'vitest';
import { startModule } from '../../src/ctk/module-start.js';
import type { IComposeModule } from '../../src/ctk/module-types.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import { CTK_HOST } from '../support/ctk-world.js';
import { failed, succeeded } from '../support/fake-runner.js';
import { API_BASE_PATH, moduleWorld, standIn } from '../support/module-world.js';

const composeModule = (overrides: Partial<IComposeModule> = {}): IComposeModule => ({
  mode: 'compose',
  directory: '/backend',
  service: 'api-kit',
  kitHost: 'api-kit',
  kitPort: 3000,
  apiBasePath: API_BASE_PATH,
  ...overrides,
});

describe('starting the module as a compose service', () => {
  it('brings up the service of the kit profile, in the compose directory, and waits for it', async () => {
    const world = moduleWorld();
    await startModule(world.context, composeModule(), CTK_HOST);
    expect(world.runner.lines()).toEqual([
      'docker compose --profile kit ps -q',
      'docker compose --profile kit up -d --build --wait --wait-timeout 4 api-kit',
    ]);
    expect(world.runner.calls[1]).toMatchObject({ cwd: '/backend', interruptible: true, timeoutMillis: 3333 });
  });

  it('refuses to start, before it brings anything up, when a service of an earlier run is still up', async () => {
    const world = moduleWorld({ handlers: [(_c, line) => (line.includes(' ps -q') ? succeeded('abc\n') : undefined)] });
    const starting = startModule(world.context, composeModule(), CTK_HOST);
    await expect(starting).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(starting).rejects.toThrow(/already running/);
    expect(world.runner.lines().some((line) => line.includes(' up '))).toBe(false);
  });

  it('lists the services after the stand-ins are up and with the variables they publish, as the compose file may need them', async () => {
    const events: string[] = [];
    const world = moduleWorld({
      handlers: [
        (command, line) => {
          if (line.includes(' ps -q')) {
            events.push('ps');
            return command.env['CATALOG_URL'] === undefined ? failed(1) : undefined;
          }
          return undefined;
        },
      ],
    });
    const module = composeModule({ standIns: [standIn('catalog', events, { CATALOG_URL: 'http://host:1' })] });
    await startModule(world.context, module, CTK_HOST);
    expect(events).toEqual(['start:catalog', 'ps']);
  });

  it('asks the service at the url of the run and the base path of the API', async () => {
    const world = moduleWorld();
    await startModule(world.context, composeModule(), CTK_HOST);
    expect(world.probed).toEqual(['http://localhost:9000/tmf-api/thing/v5']);
  });

  it('answers that the kit reaches the service by the name and the internal port the module gave', async () => {
    const world = moduleWorld();
    const module = composeModule({ kitHost: 'thing-api', kitPort: 8080 });
    expect(await startModule(world.context, module, CTK_HOST)).toEqual({
      kind: 'compose',
      host: 'thing-api',
      port: 8080,
    });
  });

  it('keeps waiting while the service answers 404 or a server error', async () => {
    const world = moduleWorld({ probe: [404, 503, 400] });
    await startModule(world.context, composeModule(), CTK_HOST);
    expect(world.probed).toHaveLength(3);
  });

  it('takes the service down at the teardown, with --remove-orphans, in the compose directory', async () => {
    const world = moduleWorld();
    await startModule(world.context, composeModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(0);
    expect(world.runner.lines().at(-1)).toBe('docker compose --profile kit down --remove-orphans');
    expect(world.runner.calls.at(-1)).toMatchObject({ cwd: '/backend', timeoutMillis: 22 });
  });

  it('counts a failed teardown when the service cannot be taken down', async () => {
    const world = moduleWorld({ handlers: [(_c, line) => (line.includes(' down ') ? failed(1) : undefined)] });
    await startModule(world.context, composeModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(1);
  });

  it('fails the start when the service does not come up, and still takes down what may have come up', async () => {
    const world = moduleWorld({ handlers: [(_c, line) => (line.includes(' up ') ? failed(1) : undefined)] });
    const starting = startModule(world.context, composeModule(), CTK_HOST);
    await expect(starting).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(starting).rejects.toThrow(/exit status 1/);
    await world.teardown.run();
    expect(world.runner.lines().at(-1)).toBe('docker compose --profile kit down --remove-orphans');
  });

  it('fails the start when the service never answers', async () => {
    const world = moduleWorld({ probe: [404] });
    await expect(startModule(world.context, composeModule(), CTK_HOST)).rejects.toThrow(/did not answer/);
  });

  it('starts the stand-ins before the service and closes them after it is down', async () => {
    const world = moduleWorld();
    const events: string[] = [];
    const recording = {
      ...world.context.effects,
      runner: {
        run: async (command: { args: readonly string[] }) => {
          events.push(command.args.includes('up') ? 'up' : command.args.includes('ps') ? 'ps' : 'down');
          return { exitCode: 0, output: '', stdout: '', timedOut: false };
        },
      },
    };
    const module = composeModule({ standIns: [standIn('catalog', events, { CATALOG_URL: 'http://host:1' })] });
    await startModule({ ...world.context, effects: recording }, module, CTK_HOST);
    await world.teardown.run();
    expect(events).toEqual(['start:catalog', 'ps', 'up', 'down', 'close:catalog']);
  });

  it('hands the variables of the stand-ins to compose, and no CONFORMANCE_ variable', async () => {
    const world = moduleWorld();
    const settings = {
      ...world.context.settings,
      environment: { PATH: '/bin', CONFORMANCE_ACCESS_TOKEN: 'never-for-compose' },
    };
    const module = composeModule({ standIns: [standIn('catalog', [], { CATALOG_URL: 'http://host:1' })] });
    await startModule({ ...world.context, settings }, module, CTK_HOST);
    expect(world.runner.calls.map((call) => call.env)).toEqual([
      { PATH: '/bin', CATALOG_URL: 'http://host:1' },
      { PATH: '/bin', CATALOG_URL: 'http://host:1' },
    ]);
  });
});
