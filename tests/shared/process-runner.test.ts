import { describe, expect, it } from 'vitest';
import type { ICommand } from '../../src/shared/ports.js';
import { createProcessRunner } from '../../src/shared/process-runner.js';
import { createFakeSpawn, type ISpawned } from '../support/fake-spawn.js';

const command = (overrides: Partial<ICommand> = {}): ICommand => ({
  program: 'docker',
  args: ['info'],
  env: { PATH: '/bin' },
  interruptible: false,
  ...overrides,
});

describe('the process runner', () => {
  it('reports the exit code 0 and the output of a process that succeeds', async () => {
    const fake = createFakeSpawn(({ child }) => {
      child.stdout.write('first ');
      child.stderr.write('second');
      child.finish(0);
    });
    const result = await createProcessRunner({ spawn: fake.spawn }).run(command());
    expect(result).toEqual({ exitCode: 0, output: 'first second' });
  });

  it('reports the exit code of a process that fails', async () => {
    const fake = createFakeSpawn(({ child }) => child.finish(3));
    const result = await createProcessRunner({ spawn: fake.spawn }).run(command());
    expect(result.exitCode).toBe(3);
  });

  it('reports 127 for a program that does not exist', async () => {
    const fake = createFakeSpawn(({ child }) => child.failToStart('ENOENT'));
    const result = await createProcessRunner({ spawn: fake.spawn }).run(command({ program: 'missing' }));
    expect(result.exitCode).toBe(127);
  });

  it('reports 130 for a process killed by a signal', async () => {
    const fake = createFakeSpawn(({ child }) => child.finish(null, 'SIGKILL'));
    const result = await createProcessRunner({ spawn: fake.spawn }).run(command());
    expect(result.exitCode).toBe(130);
  });

  it('hands the chunks of output to the callback as they arrive', async () => {
    const chunks: string[] = [];
    const fake = createFakeSpawn(({ child }) => {
      child.stdout.write('one');
      child.stdout.write('two');
      child.finish(0);
    });
    await createProcessRunner({ spawn: fake.spawn, onOutput: (chunk) => chunks.push(chunk) }).run(command());
    expect(chunks.join('')).toBe('onetwo');
  });

  it('passes the environment, the working directory and the timeout of the command, and no stdin', async () => {
    const fake = createFakeSpawn(({ child }) => child.finish(0));
    await createProcessRunner({ spawn: fake.spawn }).run(command({ cwd: '/work', timeoutMillis: 5 }));
    const [spawned] = fake.spawned;
    expect(spawned?.options).toMatchObject({ cwd: '/work', env: { PATH: '/bin' }, timeout: 5, killSignal: 'SIGKILL' });
    expect(spawned?.options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
  });
});

describe('the interruption of the process runner', () => {
  const abortOnSpawn = (controller: AbortController, finishes: (spawned: ISpawned) => void) =>
    createFakeSpawn((spawned) => {
      controller.abort();
      finishes(spawned);
    });

  it('stops an interruptible process and reports 130', async () => {
    const controller = new AbortController();
    const fake = abortOnSpawn(controller, () => undefined);
    const runner = createProcessRunner({ spawn: fake.spawn, signal: controller.signal });
    const result = await runner.run(command({ interruptible: true }));
    expect(result.exitCode).toBe(130);
  });

  it('does not hand the signal to a process that is not interruptible', async () => {
    const controller = new AbortController();
    const fake = abortOnSpawn(controller, ({ child }) => child.finish(0));
    const runner = createProcessRunner({ spawn: fake.spawn, signal: controller.signal });
    const result = await runner.run(command({ interruptible: false }));
    expect(fake.spawned[0]?.options.signal).toBeUndefined();
    expect(result.exitCode).toBe(0);
  });
});
