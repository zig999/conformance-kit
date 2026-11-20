/** Asks a URL for its status and discards the body. It rejects when nothing answers, in time, or at all. */
export function createHttpProbe(fetchFunction = fetch) {
    return {
        status: async (url, timeoutMillis, signal) => {
            const answer = await fetchFunction(url, {
                signal: AbortSignal.any([AbortSignal.timeout(timeoutMillis), signal]),
            });
            await answer.body?.cancel();
            return answer.status;
        },
    };
}
