import type { IRunEffects } from '../shared/effects.js';
import type { ISignalSource } from '../shared/ports.js';
import type { IConformanceRun } from './types.js';
export interface INodeEffects {
    readonly effects: IRunEffects;
    /** Hands over the output the sink held back. Call it when the run ends. */
    readonly finish: () => void;
}
export declare const nodeSignals: ISignalSource;
/** The real effects: the process runner, the disk, the clock, the network. The output goes through a redacting sink. */
export declare function createNodeEffects(run: IConformanceRun, signal: AbortSignal): INodeEffects;
