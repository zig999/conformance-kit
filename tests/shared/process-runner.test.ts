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
    expect(result).toEqual({ exitCode: 0, output: 'first second', stdout: 'first ', timedOut: false });
  });

  it('keeps stdout apart from stderr, so that a warning is not taken for an answer', async () => {
    const fake = createFakeSpawn(({ child }) => {
      child.stderr.write('WARN a variable is not set');
      child.finish(0);
    });
    const result = await createProcessRunner({ spawn: fake.spawn }).run(command());
    expect(result.stdout).toBe('');
    expect(result.output).toBe('WARN a variable is not set');
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

  it('keeps the output of a quiet command away from the callback', async () => {
    const chunks: string[] = [];
    const fake = createFakeSpawn(({ child }) => {
      child.stdout.write('noise');
      child.finish(0);
    });
    const runner = createProcessRunner({ spawn: fake.spawn, onOutput: (chunk) => chunks.push(chunk) });
    const result = await runner.run(command());
    expect(chunks).toEqual([]);
    expect(result.output).toBe('noise');
  });

  it('hands the chunks of output to the callback as they arrive', async () => {
    const chunks: string[] = [];
    const fake = createFakeSpawn(({ child }) => {
      child.stdout.write('one');
      child.stdout.write('two');
      child.finish(0);
    });
    await createProcessRunner({ spawn: fake.spawn, onOutput: (chunk) => chunks.push(chunk) }).run(
      command({ forwardOutput: true }),
    );
    expect(chunks.join('')).toBe('onetwo');
  });

  it('passes the environment and the working directory of the command, and no stdin', async () => {
    const fake = createFakeSpawn(({ child }) => child.finish(0));
    await createProcessRunner({ spawn: fake.spawn }).run(command({ cwd: '/work' }));
    const [spawned] = fake.spawned;
    expect(spawned?.options).toMatchObject({ cwd: '/work', env: { PATH: '/bin' } });
    expect(spawned?.options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
  });
});

describe('the time limit of a command', () => {
  interface ITimers {
    readonly scheduled: { callback: () => void; millis: number; cancelled: boolean }[];
    readonly schedule: (callback: () => void, millis: number) => () => void;
  }

  const timers = (): ITimers => {
    const scheduled: ITimers['scheduled'] = [];
    return {
      scheduled,
      schedule: (callback, millis) => {
        const entry = { callback, millis, cancelled: false };
        scheduled.push(entry);
        return () => {
          entry.cancelled = true;
        };
      },
    };
  };

  it('starts a timer of the length given, and stops the process with SIGKILL and says so when it runs out', async () => {
    const clock = timers();
    const fake = createFakeSpawn(() => clock.scheduled[0]?.callback());
    const runner = createProcessRunner({ spawn: fake.spawn, schedule: clock.schedule });
    const result = await runner.run(command({ timeoutMillis: 5 }));
    expect(clock.scheduled.map((entry) => entry.millis)).toEqual([5]);
    expect(fake.spawned[0]?.child.signals).toEqual(['SIGKILL']);
    expect(result).toMatchObject({ exitCode: 130, timedOut: true });
  });

  it('cancels the timer, and does not say it timed out, when the process ends in time', async () => {
    const clock = timers();
    const fake = createFakeSpawn(({ child }) => child.finish(0));
    const result = await createProcessRunner({ spawn: fake.spawn, schedule: clock.schedule }).run(
      command({ timeoutMillis: 5 }),
    );
    expect(clock.scheduled[0]?.cancelled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(fake.spawned[0]?.child.signals).toEqual([]);
  });

  it('starts no timer for a command with no limit', async () => {
    const clock = timers();
    const fake = createFakeSpawn(({ child }) => child.finish(0));
    await createProcessRunner({ spawn: fake.spawn, schedule: clock.schedule }).run(command());
    expect(clock.scheduled).toEqual([]);
  });

  it('does not take a process killed by someone else for one that timed out', async () => {
    const clock = timers();
    const fake = createFakeSpawn(({ child }) => child.finish(null, 'SIGKILL'));
    const result = await createProcessRunner({ spawn: fake.spawn, schedule: clock.schedule }).run(
      command({ timeoutMillis: 5 }),
    );
    expect(result).toMatchObject({ exitCode: 130, timedOut: false });
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
