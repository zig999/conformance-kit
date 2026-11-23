import type { IHttpProbe } from './ports.js';
export interface IProbeAnswer {
    readonly status: number;
    readonly body: {
        cancel(): Promise<void>;
    } | null;
}
export type FetchFunction = (url: string, init: {
    readonly signal: AbortSignal;
}) => Promise<IProbeAnswer>;
/** Asks a URL for its status and discards the body. It rejects when nothing answers, in time, or at all. */
export declare function createHttpProbe(fetchFunction?: FetchFunction): IHttpProbe;
