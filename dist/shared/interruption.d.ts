import type { ISignalSource } from './ports.js';
export interface IInterruption {
    readonly signal: AbortSignal;
    release(): void;
}
/**
 * The first SIGINT or SIGTERM interrupts the run: it tears down what it started and the user is told so. The teardown
 * can take long (a docker command may hang until its step timeout), so a second signal gives up the wait: the
 * handlers go and the signal is sent to the process itself, whose default action ends it at once.
 */
export declare function listenForInterruption(source: ISignalSource, notify?: (message: string) => void): IInterruption;
