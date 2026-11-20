import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runConformance } from '../../src/index.js';
import { createNodeEffects, nodeSignals } from '../../src/run/node-effects.js';
import type { IConformanceRun } from '../../src/run/types.js';
import { processModule } from '../support/module-world.js';

const TOKEN = 'Bearer wiring-test-token-123456';

const runIn = (moduleDirectory: string, environment: Record<string, string>, output: string[]): IConformanceRun => ({
  environment,
  moduleDirectory,
  log: () => undefined,
  output: (chunk) => output.push(chunk),
  apis: [
    {
      api: 'TMF999',
      openapiVersion: '1.0.0',
      pinnedOas: join(moduleDirectory, 'pinned.yaml'),
      generatedOas: async () => ({}),
      pinnedCopyTests: ['tests/a.test.ts'],
      answerValidationTests: ['tests/b.test.ts'],
      conformanceNode: 'constraints/tmf999-conformance',
      specificationRoot: join(moduleDirectory, 'spec'),
      kit: { tmforumDirectory: join(moduleDirectory, 'tmforum'), folder: 'tmf999-v1.0.0-ctk-1.0.0' },
      module: processModule(),
    },
  ],
});

describe('the real effects', () => {
  const run = runIn('/nowhere', { CONFORMANCE_ACCESS_TOKEN: TOKEN }, []);

  it('make a different identifier each time, and one that is safe in a container name', () => {
    const { effects } = createNodeEffects(run, new AbortController().signal);
    const first = effects.randomId();
    expect(first).toMatch(/^[0-9a-f]+$/);
    expect(effects.randomId()).not.toBe(first);
  });

  it('wait on a clock that an interruption stops', async () => {
    const { effects } = createNodeEffects(run, new AbortController().signal);
    await expect(effects.clock.sleep(1)).resolves.toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    await expect(effects.clock.sleep(60_000, controller.signal)).rejects.toThrow();
    expect(effects.clock.now()).toBeGreaterThan(0);
  });

  it('keep the private copy of the kit in the temporary directory of the system', () => {
    expect(createNodeEffects(run, new AbortController().signal).effects.temporaryDirectory).toBe(tmpdir());
  });

  it('flush the output sink without inventing output', () => {
    const output: string[] = [];
    const { effects, finish } = createNodeEffects(
      runIn('/nowhere', { CONFORMANCE_ACCESS_TOKEN: TOKEN }, output),
      new AbortController().signal,
    );
    expect(effects.runner).toBeDefined();
    finish();
    expect(output.join('')).toBe('');
  });

  it('tell whether a port is free', async () => {
    const { effects } = createNodeEffects(run, new AbortController().signal);
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
    const address = server.address();
    const busy = typeof address === 'object' && address !== null ? address.port : 0;
    expect(await effects.portIsFree(busy)).toBe(false);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(await effects.portIsFree(busy)).toBe(true);
  });
});

describe('the signals of the process', () => {
  it('are listened to and released through the same handler', () => {
    const before = process.listenerCount('SIGINT');
    const handler = (): void => undefined;
    nodeSignals.on('SIGINT', handler);
    expect(process.listenerCount('SIGINT')).toBe(before + 1);
    nodeSignals.off('SIGINT', handler);
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});

describe('runConformance, with a configuration that is refused', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'conformance-kit-run-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('answers 2, writes a report with every layer not-run, and runs nothing', async () => {
    const output: string[] = [];
    const listeners = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')];
    const code = await runConformance(runIn(directory, {}, output));
    expect(code).toBe(2);
    const report = JSON.parse(await readFile(join(directory, 'conformance-report.json'), 'utf8'));
    expect(report.results).toEqual({
      pinnedCopyIdentity: 'not-run',
      publishedDocumentComparison: 'not-run',
      answerValidation: 'not-run',
      conformanceKit: 'not-run',
    });
    expect([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]).toEqual(listeners);
  });

  it('still answers 2, the first of the precedence, when the report cannot be written either', async () => {
    const code = await runConformance(runIn(join(directory, 'missing', 'directory'), {}, []));
    expect(code).toBe(2);
  });
});
