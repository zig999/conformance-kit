/** Base of every error the kit throws. The context never holds a token or the value of a variable. */
export declare class ConformanceError extends Error {
    readonly context: Readonly<Record<string, string>>;
    constructor(message: string, context?: Readonly<Record<string, string>>, options?: ErrorOptions);
}
/** The configuration was refused (exit code 2). */
export declare class ConfigurationError extends ConformanceError {
}
/** The CTK did not run to the end (exit code 1). */
export declare class KitDidNotRunError extends ConformanceError {
}
export declare function describeError(error: unknown): string;
