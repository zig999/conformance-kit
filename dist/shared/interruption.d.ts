import type { ISignalSource } from './ports.js';
export interface IInterruption {
    readonly signal: AbortSignal;
    release(): void;
}
export declare function listenForInterruption(source: ISignalSource): IInterruption;
