import { KitDidNotRunError } from './errors.js';
import type { ISignalSource } from './ports.js';

const INTERRUPT_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export interface IInterruption {
  readonly signal: AbortSignal;
  release(): void;
}

/**
 * The first SIGINT or SIGTERM interrupts the run: it tears down what it started and the user is told so. The teardown
 * can take long (a docker command may hang until its step timeout), so a second signal gives up the wait: the
 * handlers go and the signal is sent to the process itself, whose default action ends it at once.
 */
export function listenForInterruption(
  source: ISignalSource,
  notify: (message: string) => void = () => undefined,
): IInterruption {
  const controller = new AbortController();
  const installed: { name: NodeJS.Signals; handler: () => void }[] = [];
  const release = (): void => installed.forEach(({ name, handler }) => source.off(name, handler));
  for (const name of INTERRUPT_SIGNALS) {
    const handler = (): void => {
      if (controller.signal.aborted) {
        release();
        source.sendToSelf(name);
        return;
      }
      notify(`interrupted by ${name}: stopping what the run started; interrupt again to leave at once`);
      controller.abort(new KitDidNotRunError(`the run was interrupted by ${name}`));
    };
    source.on(name, handler);
    installed.push({ name, handler });
  }
  return { signal: controller.signal, release };
}
