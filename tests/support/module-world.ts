import type { IProcessModule, IStandIn } from '../../src/ctk/module-types.js';
import { ctkWorld, type IWorldOptions } from './ctk-world.js';
import { createFakeSpawn, type ISpawned } from './fake-spawn.js';

export type ProbeAnswer = number | 'down';

export interface IModuleWorldOptions extends IWorldOptions {
  readonly probe?: readonly ProbeAnswer[];
  readonly port?: number;
  readonly onSpawn?: (spawned: ISpawned) => void;
}

export const API_BASE_PATH = '/tmf-api/thing/v5';

export function moduleWorld(options: IModuleWorldOptions = {}) {
  const base = ctkWorld(options);
  const answers = [...(options.probe ?? [200])];
  const probed: string[] = [];
  const spawning = createFakeSpawn(options.onSpawn ?? (() => undefined));
  const effects = {
    ...base.context.effects,
    spawn: spawning.spawn,
    freePort: async () => options.port ?? 5555,
    probe: {
      status: async (url: string): Promise<number> => {
        probed.push(url);
        const answer = answers.length > 1 ? answers.shift() : answers[0];
        if (answer === 'down' || answer === undefined) {
          throw new Error('nothing answers');
        }
        return answer;
      },
    },
  };
  const context = { ...base.context, effects };
  return { ...base, context, probed, spawned: spawning.spawned };
}

export const processModule = (overrides: Partial<IProcessModule> = {}): IProcessModule => ({
  mode: 'process',
  migration: { program: 'node', args: ['migrate.js'], cwd: '/backend' },
  start: { program: 'node', args: ['main.js'], cwd: '/backend' },
  apiBasePath: API_BASE_PATH,
  environment: (runtime) => ({
    PORT: String(runtime.port),
    LISTEN_ADDRESS: runtime.listenAddress,
    PUBLIC_BASE_URL: runtime.publicUrl,
    ...runtime.standIns,
  }),
  ...overrides,
});

export const standIn = (name: string, events: string[], environment: Record<string, string> = {}): IStandIn => ({
  start: async () => {
    events.push(`start:${name}`);
    return { environment, close: async () => void events.push(`close:${name}`) };
  },
});
