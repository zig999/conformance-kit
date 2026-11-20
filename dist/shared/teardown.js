import { describeError } from './errors.js';
/**
 * Stops what the run started, in the reverse order of the start (CNF-12). A step that fails is logged and the
 * others go on. A step may answer `false` to say it could not stop what it started.
 */
export class Teardown {
    steps = [];
    log;
    constructor(log) {
        this.log = log;
    }
    push(what, perform) {
        this.steps.push({ what, perform });
    }
    /** Runs every step, last pushed first, and answers how many failed. */
    async run() {
        let failures = 0;
        for (const step of this.steps.splice(0).toReversed()) {
            if (!(await this.attempt(step))) {
                failures += 1;
            }
        }
        return failures;
    }
    async attempt(step) {
        try {
            const stopped = await step.perform();
            if (stopped === false) {
                this.log(`could not stop or remove ${step.what}`);
            }
            return stopped !== false;
        }
        catch (error) {
            this.log(`could not stop or remove ${step.what}: ${describeError(error)}`);
            return false;
        }
    }
}
