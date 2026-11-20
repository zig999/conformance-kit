import { listenForInterruption } from '../shared/interruption.js';
import { createNodeEffects, nodeSignals } from './node-effects.js';
import { runWith } from './run.js';
/**
 * Runs the four layers of one API against the module and answers the exit code of CNF-11 (0 to 5). SIGINT and
 * SIGTERM interrupt it: it tears down everything it started and answers 1. It records the result in
 * `conformance-report.json`. Call it from `backend/scripts/conformance.ts` and set `process.exitCode` to the answer.
 */
export async function runConformance(run) {
    const interruption = listenForInterruption(nodeSignals);
    const { effects, finish } = createNodeEffects(run, interruption.signal);
    try {
        return await runWith(effects, run, interruption.signal);
    }
    finally {
        finish();
        interruption.release();
    }
}
