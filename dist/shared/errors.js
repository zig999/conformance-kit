/** Base of every error the kit throws. The context never holds a token or the value of a variable. */
export class ConformanceError extends Error {
    context;
    constructor(message, context = {}, options) {
        super(message, options);
        this.name = new.target.name;
        this.context = context;
    }
}
/** The configuration was refused (exit code 2). */
export class ConfigurationError extends ConformanceError {
}
/** The CTK did not run to the end (exit code 1). */
export class KitDidNotRunError extends ConformanceError {
}
export function describeError(error) {
    if (!(error instanceof Error)) {
        return String(error);
    }
    return error.cause === undefined ? error.message : `${error.message}: ${describeError(error.cause)}`;
}
