const REDACTED = '[redacted]';
/** The values that must never leave the run: the Authorization value and its token without the scheme. */
export function secretsOfAuthorization(authorization) {
    const space = authorization.indexOf(' ');
    const token = space < 0 ? '' : authorization.slice(space + 1).trim();
    return token === '' ? [authorization] : [authorization, token];
}
function longestFirst(secrets) {
    return secrets.filter((secret) => secret !== '').toSorted((first, second) => second.length - first.length);
}
/** Hides every secret in a text (CLAUDE.md §5.7: the token never shows in a message, a log or the output). */
export function createRedactor(secrets) {
    const ordered = longestFirst(secrets);
    return (text) => ordered.reduce((hidden, secret) => hidden.replaceAll(secret, REDACTED), text);
}
/**
 * A sink for streamed output that hides a secret even when two chunks split it: it holds back the last
 * characters that could be the start of a secret until the next chunk shows whether they are.
 */
export function createRedactingSink(sink, secrets) {
    const redact = createRedactor(secrets);
    const holdBack = Math.max(0, ...secrets.map((secret) => secret.length)) - 1;
    let pending = '';
    return {
        write: (chunk) => {
            const hidden = redact(pending + chunk);
            const releasable = hidden.length - Math.max(0, holdBack);
            pending = hidden.slice(Math.max(0, releasable));
            if (releasable > 0) {
                sink(hidden.slice(0, releasable));
            }
        },
        flush: () => {
            if (pending !== '') {
                sink(redact(pending));
                pending = '';
            }
        },
    };
}
