import { describe, expect, it } from 'vitest';
import { startModule } from '../../src/ctk/module-start.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import { CTK_HOST } from '../support/ctk-world.js';
import { FakeRunner, failed, succeeded } from '../support/fake-runner.js';
import { FakeProcessGroup } from '../support/fake-spawn.js';
import { moduleWorld, processModule, standIn } from '../support/module-world.js';

const CONFORMANCE_ENVIRONMENT = {
  PATH: '/bin',
  AUTH_ISSUER: 'https://issuer.example',
  CONFORMANCE_ACCESS_TOKEN: 'never-for-the-module',
  CONFORMANCE_SERVICE_URL: 'http://localhost:9000',
};

describe('starting the module as a process', () => {
  it('applies the migration before it starts the module', async () => {
    const world = moduleWorld();
    const order: string[] = [];
    const runner = new FakeRunner(async (command) => (order.push(`run ${command.program}`), succeeded()));
    const effects = {
      ...world.context.effects,
      runner,
      spawn: (...args: Parameters<typeof world.context.effects.spawn>) => (
        order.push('start'),
        world.context.effects.spawn(...args)
      ),
    };
    await startModule({ ...world.context, effects }, processModule(), CTK_HOST);
    expect(order).toEqual(['run node', 'start']);
  });

  it('runs the migration in its directory, interruptible, with the start timeout', async () => {
    const world = moduleWorld();
    await startModule(world.context, processModule(), CTK_HOST);
    expect(world.runner.calls[0]).toMatchObject({ cwd: '/backend', interruptible: true, timeoutMillis: 3333 });
  });

  it('does not start the module when the migration fails, and says so', async () => {
    const world = moduleWorld({ handlers: [(_c, line) => (line === 'node migrate.js' ? failed(3) : undefined)] });
    const starting = startModule(world.context, processModule(), CTK_HOST);
    await expect(starting).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(starting).rejects.toThrow(/migrations did not apply \(exit status 3\)/);
    expect(world.spawned).toHaveLength(0);
  });

  it('starts the module without a migration when it has none', async () => {
    const world = moduleWorld();
    await startModule(world.context, processModule({ migration: undefined }), CTK_HOST);
    expect(world.runner.calls).toHaveLength(0);
    expect(world.spawned).toHaveLength(1);
  });

  it('listens on all addresses, on the port of the service url, and tells the module the public url the kit uses', async () => {
    const world = moduleWorld();
    await startModule(world.context, processModule(), CTK_HOST);
    expect(world.spawned[0]?.options.env).toMatchObject({
      PORT: '9000',
      LISTEN_ADDRESS: '0.0.0.0',
      PUBLIC_BASE_URL: `http://${CTK_HOST}:9000`,
    });
  });

  it('answers how the kit reaches the module: the port of the service url in process mode', async () => {
    const world = moduleWorld();
    expect(await startModule(world.context, processModule(), CTK_HOST)).toEqual({ kind: 'process', port: 9000 });
  });

  it('asks the module, from the host, on that port and the base path of the API', async () => {
    const world = moduleWorld();
    await startModule(world.context, processModule(), CTK_HOST);
    expect(world.probed).toEqual(['http://localhost:9000/tmf-api/thing/v5']);
  });

  it.each([
    ['http://localhost', 80],
    ['https://module.example', 443],
    ['http://localhost:8123', 8123],
  ])('takes the port of the service url %s as %i', async (serviceUrl, port) => {
    const world = moduleWorld();
    const context = { ...world.context, settings: { ...world.context.settings, serviceUrl } };
    await startModule(context, processModule(), CTK_HOST);
    expect(world.checkedPorts).toEqual([port]);
    expect(world.spawned[0]?.options.env).toMatchObject({ PORT: String(port) });
  });

  it('refuses to start, before anything else, when the port of the service url is not free', async () => {
    const world = moduleWorld({ busyPorts: [9000] });
    const events: string[] = [];
    const starting = startModule(world.context, processModule({ standIns: [standIn('catalog', events)] }), CTK_HOST);
    await expect(starting).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(starting).rejects.toThrow(/port 9000 .*CONFORMANCE_SERVICE_URL/);
    expect(events).toEqual([]);
    expect(world.runner.calls).toHaveLength(0);
    expect(world.spawned).toHaveLength(0);
  });

  it('never hands a CONFORMANCE_ variable to the migration, to the module or to what it declares', async () => {
    const world = moduleWorld();
    const context = { ...world.context, settings: { ...world.context.settings, environment: CONFORMANCE_ENVIRONMENT } };
    const module = processModule({
      environment: (runtime) => ({ PORT: String(runtime.port), CONFORMANCE_SNEAKED: 'x' }),
    });
    await startModule(context, module, CTK_HOST);
    const handed = [world.runner.calls[0]?.env, world.spawned[0]?.options.env];
    for (const environment of handed) {
      expect(Object.keys(environment ?? {}).filter((name) => name.startsWith('CONFORMANCE_'))).toEqual([]);
      expect(environment).toMatchObject({ PATH: '/bin', AUTH_ISSUER: 'https://issuer.example' });
    }
  });

  it('lets what the module declares win over the environment it inherits', async () => {
    const world = moduleWorld();
    const context = {
      ...world.context,
      settings: { ...world.context.settings, environment: { PORT: '1', PATH: '/bin' } },
    };
    await startModule(context, processModule(), CTK_HOST);
    expect(world.spawned[0]?.options.env).toMatchObject({ PORT: '9000', PATH: '/bin' });
  });

  it('starts the stand-ins first, hands their variables to the module, and closes them after it', async () => {
    const world = moduleWorld();
    const events: string[] = [];
    const module = processModule({
      standIns: [
        standIn('catalog', events, { CATALOG_URL: 'http://127.0.0.1:1' }),
        standIn('party', events, { PARTY_URL: 'http://127.0.0.1:2' }),
      ],
    });
    await startModule(world.context, module, CTK_HOST);
    expect(world.spawned[0]?.options.env).toMatchObject({
      CATALOG_URL: 'http://127.0.0.1:1',
      PARTY_URL: 'http://127.0.0.1:2',
    });
    expect(events).toEqual(['start:catalog', 'start:party']);
    await world.teardown.run();
    expect(events).toEqual(['start:catalog', 'start:party', 'close:party', 'close:catalog']);
  });

  it('closes the stand-ins it started when a later one does not start', async () => {
    const world = moduleWorld();
    const events: string[] = [];
    const broken = { start: async () => Promise.reject(new Error('could not listen')) };
    const starting = startModule(
      world.context,
      processModule({ standIns: [standIn('catalog', events), broken] }),
      CTK_HOST,
    );
    await expect(starting).rejects.toBeInstanceOf(KitDidNotRunError);
    await world.teardown.run();
    expect(events).toEqual(['start:catalog', 'close:catalog']);
    expect(world.spawned).toHaveLength(0);
  });
});

describe('stopping the module', () => {
  it('stops it with SIGTERM and no more when it exits, and waits for nothing', async () => {
    const world = moduleWorld();
    await startModule(world.context, processModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(0);
    expect(world.spawned[0]?.child.signals).toEqual(['SIGTERM']);
    expect(world.clock.sleeps).toEqual([]);
  });

  it('sends SIGKILL when it does not exit within the step timeout, waiting no longer than that', async () => {
    const world = moduleWorld({ onSpawn: ({ child }) => void (child.exitsOn = new Set(['SIGKILL'])) });
    await startModule(world.context, processModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(0);
    expect(world.spawned[0]?.child.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(world.clock.sleeps.reduce((total, millis) => total + millis, 0)).toBe(22);
  });

  it('does not signal a module that has already ended', async () => {
    const world = moduleWorld({ probe: ['down', 200], onSpawn: ({ child }) => child.finish(0) });
    await startModule(world.context, processModule(), CTK_HOST).catch(() => undefined);
    await world.teardown.run();
    expect(world.spawned[0]?.child.signals).toEqual([]);
  });

  it('stops the module before the stand-ins, whatever the outcome of the wait', async () => {
    const world = moduleWorld({ probe: [404] });
    const events: string[] = [];
    const starting = startModule(world.context, processModule({ standIns: [standIn('catalog', events)] }), CTK_HOST);
    await expect(starting).rejects.toBeInstanceOf(KitDidNotRunError);
    await world.teardown.run();
    expect(world.spawned[0]?.child.signals).toEqual(['SIGTERM']);
    expect(events).toEqual(['start:catalog', 'close:catalog']);
  });
});

describe('stopping everything the module started, not only the process the run launched', () => {
  const withGroup = (group: FakeProcessGroup, options: Parameters<typeof moduleWorld>[0] = {}) => {
    const world = moduleWorld(options);
    return { ...world, context: { ...world.context, effects: { ...world.context.effects, processes: group } } };
  };

  it('starts the module as the leader of its own process group, so that its descendants can be reached', async () => {
    const world = moduleWorld();
    await startModule(world.context, processModule(), CTK_HOST);
    expect(world.spawned[0]?.options.detached).toBe(true);
  });

  it('signals the group with SIGTERM and is done when the group is gone', async () => {
    const group = new FakeProcessGroup(['SIGTERM']);
    const world = withGroup(group);
    await startModule(world.context, processModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(0);
    expect(group.signals).toEqual(['SIGTERM']);
  });

  it('sends SIGKILL to the group when a descendant outlives the grace, as when `pnpm start` ends and the server stays', async () => {
    const group = new FakeProcessGroup(['SIGKILL']);
    const world = withGroup(group, { onSpawn: ({ child }) => child.finish(0) });
    await startModule(world.context, processModule(), CTK_HOST).catch(() => undefined);
    expect(await world.teardown.run()).toBe(0);
    expect(group.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(world.clock.sleeps.length).toBeGreaterThan(0);
  });

  it('still stops the group when the process the run launched ended on its own and left a descendant behind', async () => {
    const group = new FakeProcessGroup(['SIGTERM']);
    const world = withGroup(group, { probe: ['down'], onSpawn: ({ child }) => child.finish(1) });
    await expect(startModule(world.context, processModule(), CTK_HOST)).rejects.toThrow(/ended before it answered/);
    expect(await world.teardown.run()).toBe(0);
    expect(group.signals).toEqual(['SIGTERM']);
  });

  it('counts a failed teardown when the group survives even SIGKILL, so that the run does not claim to be clean', async () => {
    const group = new FakeProcessGroup([]);
    const world = withGroup(group);
    await startModule(world.context, processModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(1);
    expect(group.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(world.log.join('\n')).toContain('the module process');
  });

  it('signals nothing, and waits for nothing, when the group is already gone', async () => {
    const group = new FakeProcessGroup([], false);
    const world = withGroup(group);
    await startModule(world.context, processModule(), CTK_HOST);
    expect(await world.teardown.run()).toBe(0);
    expect(group.signals).toEqual([]);
    expect(world.clock.sleeps).toEqual([]);
  });
});

describe('a module that ends before it answers', () => {
  it('fails the start and says the module ended, with its status, and not its output', async () => {
    const world = moduleWorld({
      probe: ['down'],
      onSpawn: ({ child }) => {
        child.stderr.write('a line that may hold a value');
        child.finish(1);
      },
    });
    const starting = startModule(world.context, processModule(), CTK_HOST);
    await expect(starting).rejects.toThrow(/module ended before it answered: ended with status 1/);
    await expect(starting).rejects.not.toThrow(/may hold a value/);
  });

  it('fails the start when the module cannot be started at all', async () => {
    const world = moduleWorld({ probe: ['down'], onSpawn: ({ child }) => child.failToStart('ENOENT') });
    await expect(startModule(world.context, processModule(), CTK_HOST)).rejects.toThrow(/could not be started/);
  });
});
