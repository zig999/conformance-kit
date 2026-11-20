import { KitDidNotRunError } from './errors.js';
const INTERRUPT_SIGNALS = ['SIGINT', 'SIGTERM'];
export function listenForInterruption(source) {
    const controller = new AbortController();
    const handlers = INTERRUPT_SIGNALS.map((name) => {
        const handler = () => controller.abort(new KitDidNotRunError(`the run was interrupted by ${name}`));
        source.on(name, handler);
        return { name, handler };
    });
    return {
        signal: controller.signal,
        release: () => handlers.forEach(({ name, handler }) => source.off(name, handler)),
    };
}
