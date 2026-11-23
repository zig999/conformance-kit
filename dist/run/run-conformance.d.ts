import type { IConformanceRun } from './types.js';
/**
 * Runs the four layers of one API against the module and answers the exit code of CNF-11 (0 to 5). SIGINT and
 * SIGTERM interrupt it: it tears down everything it started and answers 1. It records the result in
 * `conformance-report.json`. Call it from `backend/scripts/conformance.ts` and set `process.exitCode` to the answer.
 */
export declare function runConformance(run: IConformanceRun): Promise<number>;
