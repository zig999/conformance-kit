import { describe, expect, it } from 'vitest';
import { readDeviationRegisterFrom } from '../../src/deviations/register.js';
import { ensureDocker, ensureNetwork, runKitContainer } from '../../src/ctk/kit-run.js';
import { requireNothingRunning } from '../../src/ctk/previous-run.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import {
  AUTHORIZATION,
  CONTAINER,
  CTK_HOST,
  KIT_DIRECTORY,
  ctkWorld,
  reportWithFailure,
  type IWorldOptions,
} from '../support/ctk-world.js';
import { failed, succeeded } from '../support/fake-runner.js';
import { CONFORMANCE_NODE, SPECIFICATION_ROOT, nodeText, specificationWith } from '../support/deviation-nodes.js';

const reach = { kind: 'process', port: 4321 } as const;
const WORKSPACE = '/tmp/conformance-kit-ctk-1';

const register = (statement = 'Nothing is excluded.') =>
  readDeviationRegisterFrom(
    specificationWith({ 'constraints/tmf999-known': nodeText(`statement: ${statement}`) }),
    SPECIFICATION_ROOT,
    CONFORMANCE_NODE,
  );

const runKit = async (options: IWorldOptions = {}, statement?: string) => {
  const world = ctkWorld(options);
  const outcome = await runKitContainer(world.context, reach, await register(statement));
  return { ...world, outcome };
};

describe('the docker daemon', () => {
  it('stops the run with a kit that did not run when the daemon does not answer', async () => {
    const world = ctkWorld({ handlers: [(_c, line) => (line === 'docker info' ? failed(1) : undefined)] });
    const reading = ensureDocker(world.context);
    await expect(reading).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(reading).rejects.toThrow(/docker daemon/);
    expect(world.runner.lines()).toEqual(['docker info']);
  });

  it('goes on when the daemon answers, with the step timeout and the environment given', async () => {
    const world = ctkWorld();
    await ensureDocker(world.context);
    expect(world.runner.calls[0]).toMatchObject({ timeoutMillis: 22, env: { PATH: '/bin' }, interruptible: false });
  });
});

describe('the docker network', () => {
  it('creates the network tmf when it does not exist, and removes it at the teardown', async () => {
    const world = ctkWorld({ networkExists: false });
    await ensureNetwork(world.context);
    expect(world.runner.lines()).toEqual(['docker network inspect tmf', 'docker network create tmf']);
    expect(await world.teardown.run()).toBe(0);
    expect(world.runner.lines().at(-1)).toBe('docker network rm tmf');
  });

  it('leaves alone, and never removes, a network that already existed', async () => {
    const world = ctkWorld({ networkExists: true });
    await ensureNetwork(world.context);
    expect(await world.teardown.run()).toBe(0);
    expect(world.runner.lines()).toEqual(['docker network inspect tmf']);
  });

  it('stops the run when the network cannot be created', async () => {
    const world = ctkWorld({
      networkExists: false,
      handlers: [(_c, line) => (line === 'docker network create tmf' ? failed(1) : undefined)],
    });
    await expect(ensureNetwork(world.context)).rejects.toBeInstanceOf(KitDidNotRunError);
    expect(await world.teardown.run()).toBe(0);
    expect(world.runner.lines()).not.toContain('docker network rm tmf');
  });

  it('counts a network it created and could not remove as a failed teardown', async () => {
    const world = ctkWorld({
      networkExists: false,
      handlers: [(_c, line) => (line === 'docker network rm tmf' ? failed(1) : undefined)],
    });
    await ensureNetwork(world.context);
    expect(await world.teardown.run()).toBe(1);
  });
});

describe('a service of a previous run', () => {
  const compose = { directory: '/backend' };

  it('refuses to start when a service of the kit profile is still up, and says how to stop it', async () => {
    const world = ctkWorld({ handlers: [(_c, line) => (line.includes(' ps -q') ? succeeded('abc123\n') : undefined)] });
    const reading = requireNothingRunning(world.context, compose);
    await expect(reading).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(reading).rejects.toThrow(/docker compose --profile kit down/);
    expect(world.runner.calls[0]).toMatchObject({ cwd: '/backend', timeoutMillis: 22 });
  });

  it('goes on when nothing is up', async () => {
    const world = ctkWorld();
    await expect(requireNothingRunning(world.context, compose)).resolves.toBeUndefined();
    expect(world.runner.lines()).toEqual(['docker compose --profile kit ps -q']);
  });

  it('refuses to start when it cannot list the services', async () => {
    const world = ctkWorld({ handlers: [(_c, line) => (line.includes(' ps -q') ? failed(1) : undefined)] });
    await expect(requireNothingRunning(world.context, compose)).rejects.toBeInstanceOf(KitDidNotRunError);
  });
});

describe('the private copy of the kit', () => {
  it('writes the Authorization header only to the config.json of the copy', async () => {
    const { files } = await runKit();
    const holding = [...files.entries].filter(([, entry]) => entry.text.includes(AUTHORIZATION));
    expect(holding).toHaveLength(1);
    expect(holding[0]?.[0]).toBe(`${WORKSPACE}/config.json`);
  });

  it('makes the config.json readable by the container of the kit (mode 0644), and the rest of the copy private', async () => {
    const { files } = await runKit();
    expect(files.modeOf(`${WORKSPACE}/config.json`)).toBe(0o644);
    expect(files.modeOf(`${WORKSPACE}/compose.override.yaml`)).toBe(0o600);
    expect(files.modeOf(`${WORKSPACE}/docker-compose.yaml`)).toBe(0o600);
    expect(files.modeOf(WORKSPACE)).toBe(0o700);
  });

  it('copies the compose file and the environment file of the kit, privately', async () => {
    const { files } = await runKit();
    expect(files.textOf(`${WORKSPACE}/docker-compose.yaml`)).toContain('image: example');
    expect(files.textOf(`${WORKSPACE}/.env`)).toBe('HTTP_PROXY=\n');
    expect(files.modeOf(`${WORKSPACE}/docker-compose.yaml`)).toBe(0o600);
    expect(files.modeOf(`${WORKSPACE}/.env`)).toBe(0o600);
    expect(files.modeOf(WORKSPACE)).toBe(0o700);
  });

  it('creates reports/ for the container to write', async () => {
    const { files } = await runKit();
    expect(files.directories.has(`${WORKSPACE}/reports`)).toBe(true);
  });

  it('points the url of the config.json of the copy at the module, keeping the name the kit uses', async () => {
    const { files } = await runKit();
    const url = JSON.parse(files.textOf(`${WORKSPACE}/config.json`) ?? '{}').url;
    expect(url).toBe(`http://${CTK_HOST}:4321/tmf-api/thing/v5`);
  });

  it('maps that name to the host gateway, in process mode', async () => {
    const { files } = await runKit();
    expect(files.textOf(`${WORKSPACE}/compose.override.yaml`)).toContain(`"${CTK_HOST}:host-gateway"`);
  });

  it('does not touch any file of the folder of the kit', async () => {
    const world = ctkWorld();
    const before = JSON.stringify([...world.files.entries].filter(([path]) => path.startsWith(KIT_DIRECTORY)));
    await runKitContainer(world.context, reach, await register());
    await world.teardown.run();
    const after = JSON.stringify([...world.files.entries].filter(([path]) => path.startsWith(KIT_DIRECTORY)));
    expect(after).toBe(before);
    expect([...world.files.directories.keys()].filter((path) => path.startsWith(KIT_DIRECTORY))).toEqual([]);
    expect(world.files.removed.filter((path) => path.startsWith(KIT_DIRECTORY))).toEqual([]);
  });

  it('removes the copy at the teardown', async () => {
    const world = ctkWorld();
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(0);
    expect(world.files.removed).toContain(WORKSPACE);
    expect([...world.files.entries.keys()].filter((path) => path.startsWith(WORKSPACE))).toEqual([]);
  });

  it('removes the copy even when the kit could not be prepared', async () => {
    const world = ctkWorld();
    world.files.failOn('readText', 'config.json');
    await expect(runKitContainer(world.context, reach, await register())).rejects.toBeInstanceOf(KitDidNotRunError);
    expect(await world.teardown.run()).toBe(0);
    expect(world.files.removed).toContain(WORKSPACE);
  });

  it('refuses a kit folder that lacks its compose file', async () => {
    const world = ctkWorld();
    world.files.entries.delete(`${KIT_DIRECTORY}/docker-compose.yaml`);
    await expect(runKitContainer(world.context, reach, await register())).rejects.toBeInstanceOf(KitDidNotRunError);
  });

  it('copies the .env of the kit only when it exists', async () => {
    const world = ctkWorld();
    world.files.entries.delete(`${KIT_DIRECTORY}/.env`);
    const outcome = await runKitContainer(world.context, reach, await register());
    expect(outcome.passed).toBe(true);
    expect(world.files.textOf(`${WORKSPACE}/.env`)).toBeUndefined();
    expect(world.files.textOf(`${WORKSPACE}/docker-compose.yaml`)).toBeDefined();
  });
});

describe('emptying the reports as root', () => {
  const REPORTS = `${WORKSPACE}/reports`;

  it('empties reports/ with a container as root when it cannot be removed, then removes the copy', async () => {
    const world = ctkWorld();
    world.files.failOn('removeTree', REPORTS, 1);
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(0);
    const emptying = world.runner.lines().find((line) => line.includes('--user 0'));
    expect(emptying).toContain('--entrypoint find');
    expect(emptying).toContain('--no-deps');
    expect(emptying).toContain('/reports -mindepth 1 -delete');
    expect(emptying).toContain(`--name ${CONTAINER}-emptying`);
    expect(world.files.removed).toEqual([WORKSPACE]);
  });

  it('tries reports/ alone first, so that the compose files the emptying needs are still there', async () => {
    const world = ctkWorld({
      handlers: [
        (_command, line) => {
          if (line.includes('--user 0')) {
            expect(world.files.textOf(`${WORKSPACE}/docker-compose.yaml`)).toBeDefined();
            expect(world.files.textOf(`${WORKSPACE}/compose.override.yaml`)).toBeDefined();
          }
          return undefined;
        },
      ],
    });
    world.files.failOn('removeTree', REPORTS, 1);
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(0);
    expect(world.files.removalAttempts[0]).toBe(REPORTS);
  });

  it('does not run a container as root when reports/ can be removed', async () => {
    const world = ctkWorld();
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(0);
    expect(world.runner.lines().some((line) => line.includes('--user 0'))).toBe(false);
    expect(world.files.removed).toEqual([REPORTS, WORKSPACE]);
  });

  it('counts a failed teardown when even the emptying fails', async () => {
    const world = ctkWorld({ handlers: [(_c, line) => (line.includes('--user 0') ? failed(1) : undefined)] });
    world.files.failOn('removeTree', REPORTS, 1);
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(1);
  });

  it('counts a failed teardown when the copy cannot be removed after the emptying either', async () => {
    const world = ctkWorld();
    world.files.failOn('removeTree', WORKSPACE);
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(1);
  });
});

describe('running the kit', () => {
  it('runs the kit service as docker compose run -T --rm with a unique name, in the copy', async () => {
    const { runner } = await runKit();
    const run = runner.lines().find((line) => line.includes(' run -T --rm --name '));
    expect(run).toBe(
      `docker compose --project-directory ${WORKSPACE} -f ${WORKSPACE}/docker-compose.yaml -f ${WORKSPACE}/compose.override.yaml run -T --rm --name ${CONTAINER} ctk`,
    );
  });

  it('runs the kit with the run timeout, interruptible, and the other steps with the step timeout', async () => {
    const { runner } = await runKit();
    const run = runner.calls.find((call) => call.args.includes('--rm'));
    expect(run).toMatchObject({ timeoutMillis: 111, interruptible: true });
    expect(runner.calls.filter((call) => call !== run).every((call) => call.timeoutMillis === 22)).toBe(true);
  });

  it('never hands the token to a command', async () => {
    const { runner } = await runKit();
    const everything = JSON.stringify(runner.calls);
    expect(everything).not.toContain('top-secret-token-value');
  });

  it('passes the environment given to every command, and nothing else', async () => {
    const { runner } = await runKit({ environment: { PATH: '/usr/bin', HOME: '/home/me' } });
    expect(runner.calls.every((call) => JSON.stringify(call.env) === '{"PATH":"/usr/bin","HOME":"/home/me"}')).toBe(
      true,
    );
  });

  it('passes when every item passed', async () => {
    const { outcome } = await runKit();
    expect(outcome).toEqual({ passed: true, failedItems: [], uncoveredItems: [] });
  });

  it('fails when an item failed and no deviation excludes it, and says which', async () => {
    const { outcome, log } = await runKit({ kitReport: reportWithFailure('POST /thing returns 201'), kitExit: 1 });
    expect(outcome).toEqual({
      passed: false,
      failedItems: ['POST /thing returns 201'],
      uncoveredItems: ['POST /thing returns 201'],
    });
    expect(log.join('\n')).toContain('POST /thing returns 201');
  });

  it('fails when an item failed even though the kit exits with 0, as the real kit does', async () => {
    const { outcome } = await runKit({ kitReport: reportWithFailure('POST /thing returns 201') });
    expect(outcome).toMatchObject({ passed: false, uncoveredItems: ['POST /thing returns 201'] });
  });

  it('passes when the failed item is excluded by a deviation', async () => {
    const { outcome } = await runKit(
      { kitReport: reportWithFailure('POST /thing returns 201'), kitExit: 1 },
      'Excludes `POST /thing returns 201`.',
    );
    expect(outcome).toMatchObject({ passed: true, failedItems: ['POST /thing returns 201'], uncoveredItems: [] });
  });

  it('says the kit did not run to the end when it writes no report', async () => {
    const world = ctkWorld({ kitReport: undefined });
    await expect(runKitContainer(world.context, reach, await register())).rejects.toBeInstanceOf(KitDidNotRunError);
  });

  it('says the kit did not run to the end when it fails and its report holds no failed item', async () => {
    const world = ctkWorld({ kitExit: 2 });
    await expect(runKitContainer(world.context, reach, await register())).rejects.toThrow(/exited with status 2/);
  });

  it('stops with a kit that did not run when the run was interrupted, without reading a report', async () => {
    const world = ctkWorld({
      handlers: [
        (command, line) => {
          if (line.includes(' run -T --rm --name ') && command.interruptible) {
            world.interrupt();
            return failed(130);
          }
          return undefined;
        },
      ],
    });
    await expect(runKitContainer(world.context, reach, await register())).rejects.toBeInstanceOf(KitDidNotRunError);
  });
});

describe('removing the container of the kit', () => {
  const removal = (lines: readonly string[]): string[] => lines.filter((line) => line.startsWith('docker rm -f'));

  it('lists the container and removes nothing when --rm already took it, after a pass', async () => {
    const world = ctkWorld();
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(0);
    expect(world.runner.lines()).toContain(`docker ps -a -q --filter name=^${CONTAINER}$`);
    expect(removal(world.runner.lines())).toEqual([]);
  });

  it('removes the container that is left behind after a failure of the kit', async () => {
    const world = ctkWorld({
      kitReport: reportWithFailure('x'),
      kitExit: 1,
      containerListing: 'deadbeef\n',
    });
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(0);
    expect(removal(world.runner.lines())).toEqual([`docker rm -f ${CONTAINER}`]);
  });

  it('removes the container that is left behind after an interruption', async () => {
    const world = ctkWorld({
      containerListing: 'deadbeef\n',
      handlers: [
        (command, line) => {
          if (line.includes(' run -T --rm --name ') && command.interruptible) {
            world.interrupt();
            return failed(130);
          }
          return undefined;
        },
      ],
    });
    await expect(runKitContainer(world.context, reach, await register())).rejects.toBeInstanceOf(KitDidNotRunError);
    expect(await world.teardown.run()).toBe(0);
    expect(removal(world.runner.lines())).toEqual([`docker rm -f ${CONTAINER}`]);
  });

  it('counts a failed teardown when the container cannot be removed', async () => {
    const world = ctkWorld({
      containerListing: 'deadbeef\n',
      handlers: [(_c, line) => (line.startsWith('docker rm -f') ? failed(1) : undefined)],
    });
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(1);
  });

  it('counts a failed teardown when it cannot even list the containers', async () => {
    const world = ctkWorld({ handlers: [(_c, line) => (line.startsWith('docker ps -a') ? failed(1) : undefined)] });
    await runKitContainer(world.context, reach, await register());
    expect(await world.teardown.run()).toBe(1);
  });

  it('stops the container, the copy and the network in the reverse order of the start', async () => {
    const world = ctkWorld({ networkExists: false, containerListing: 'deadbeef\n' });
    await ensureNetwork(world.context);
    await runKitContainer(world.context, reach, await register());
    await world.teardown.run();
    const lines = world.runner.lines();
    const container = lines.indexOf(`docker rm -f ${CONTAINER}`);
    const network = lines.indexOf('docker network rm tmf');
    expect(container).toBeGreaterThan(-1);
    expect(network).toBeGreaterThan(container);
    expect(world.files.removed.at(-1)).toBe(WORKSPACE);
  });
});
