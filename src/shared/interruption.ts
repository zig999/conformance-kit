import { KitDidNotRunError } from './errors.js';
import type { ISignalSource } from './ports.js';

const INTERRUPT_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export interface IInterruption {
  readonly signal: AbortSignal;
  release(): void;
}

export function listenForInterruption(source: ISignalSource): IInterruption {
  const controller = new AbortController();
  const handlers = INTERRUPT_SIGNALS.map((name) => {
    const handler = (): void => controller.abort(new KitDidNotRunError(`the run was interrupted by ${name}`));
    source.on(name, handler);
    return { name, handler };
  });
  return {
    signal: controller.signal,
    release: (): void => handlers.forEach(({ name, handler }) => source.off(name, handler)),
  };
}
