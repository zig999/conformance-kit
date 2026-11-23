import { type LayerResult } from '../report/record.js';
import type { Environment, ICommandRunner, IFiles } from '../shared/ports.js';
export interface ITestLayersInput {
    readonly pinnedCopyTests: readonly string[];
    readonly answerValidationTests: readonly string[];
    readonly moduleDirectory: string;
    /** The environment the tests get. The caller has already taken the CONFORMANCE_* variables out of it. */
    readonly environment: Environment;
    readonly timeoutMillis: number;
    readonly signal: AbortSignal;
}
export interface ITestLayersEffects {
    readonly runner: ICommandRunner;
    readonly files: IFiles;
    readonly log: (message: string) => void;
    readonly temporaryDirectory: string;
}
export interface ITestLayerResults {
    readonly pinnedCopyIdentity: LayerResult;
    readonly answerValidation: LayerResult;
}
/** Layers 1 and 3 (CNF-01, CNF-03): the module's own tests, run with vitest. A set with no test counts as a failure. */
export declare function runTestLayers(effects: ITestLayersEffects, input: ITestLayersInput): Promise<ITestLayerResults>;
