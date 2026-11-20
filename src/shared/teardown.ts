import { describeError } from './errors.js';

type Step = () => Promise<boolean | void>;

interface IStep {
  readonly what: string;
  readonly perform: Step;
}

/**
 * Stops what the run started, in the reverse order of the start (CNF-12). A step that fails is logged and the
 * others go on. A step may answer `false` to say it could not stop what it started.
 */
export class Teardown {
  private readonly steps: IStep[] = [];
  private readonly log: (message: string) => void;

  constructor(log: (message: string) => void) {
    this.log = log;
  }

  push(what: string, perform: Step): void {
    this.steps.push({ what, perform });
  }

  /** Runs every step, last pushed first, and answers how many failed. */
  async run(): Promise<number> {
    let failures = 0;
    for (const step of this.steps.splice(0).toReversed()) {
      if (!(await this.attempt(step))) {
        failures += 1;
      }
    }
    return failures;
  }

  private async attempt(step: IStep): Promise<boolean> {
    try {
      const stopped = await step.perform();
      if (stopped === false) {
        this.log(`could not stop or remove ${step.what}`);
      }
      return stopped !== false;
    } catch (error) {
      this.log(`could not stop or remove ${step.what}: ${describeError(error)}`);
      return false;
    }
  }
}
