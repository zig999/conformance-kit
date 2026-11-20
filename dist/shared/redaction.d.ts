/** The values that must never leave the run: the Authorization value and its token without the scheme. */
export declare function secretsOfAuthorization(authorization: string): string[];
/** Hides every secret in a text (CLAUDE.md §5.7: the token never shows in a message, a log or the output). */
export declare function createRedactor(secrets: readonly string[]): (text: string) => string;
export interface IRedactingSink {
    write(chunk: string): void;
    /** Hands over what the sink held back. Call it when the output has ended. */
    flush(): void;
}
/**
 * A sink for streamed output that hides a secret even when two chunks split it: it holds back the last
 * characters that could be the start of a secret until the next chunk shows whether they are.
 */
export declare function createRedactingSink(sink: (text: string) => void, secrets: readonly string[]): IRedactingSink;
