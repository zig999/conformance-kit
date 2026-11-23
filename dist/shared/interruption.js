import { KitDidNotRunError } from './errors.js';
const INTERRUPT_SIGNALS = ['SIGINT', 'SIGTERM'];
/**
 * The first SIGINT or SIGTERM interrupts the run: it tears down what it started and the user is told so. The teardown
 * can take long (a docker command may hang until its step timeout), so a second signal gives up the wait: the
 * handlers go and the signal is sent to the process itself, whose default action ends it at once.
 */
export function listenForInterruption(source, notify = () => undefined) {
    const controller = new AbortController();
    const installed = [];
    const release = () => installed.forEach(({ name, handler }) => source.off(name, handler));
    for (const name of INTERRUPT_SIGNALS) {
        const handler = () => {
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
