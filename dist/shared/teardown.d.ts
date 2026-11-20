type Step = () => Promise<boolean | void>;
/**
 * Stops what the run started, in the reverse order of the start (CNF-12). A step that fails is logged and the
 * others go on. A step may answer `false` to say it could not stop what it started.
 */
export declare class Teardown {
    private readonly steps;
    private readonly log;
    constructor(log: (message: string) => void);
    push(what: string, perform: Step): void;
    /** Runs every step, last pushed first, and answers how many failed. */
    run(): Promise<number>;
    private attempt;
}
export {};
