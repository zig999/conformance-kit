import { describe, expect, it } from 'vitest';
import { createHttpProbe, type FetchFunction } from '../../src/shared/http-probe.js';

const answering =
  (status: number, cancelled: string[]): FetchFunction =>
  async () => ({ status, body: { cancel: async () => void cancelled.push('body') } });

describe('the HTTP probe', () => {
  it('answers the status of the URL and discards the body', async () => {
    const cancelled: string[] = [];
    const probe = createHttpProbe(answering(401, cancelled));
    expect(await probe.status('http://x/api', 10, new AbortController().signal)).toBe(401);
    expect(cancelled).toEqual(['body']);
  });

  it('copes with an answer that has no body', async () => {
    const probe = createHttpProbe(async () => ({ status: 204, body: null }));
    expect(await probe.status('http://x/api', 10, new AbortController().signal)).toBe(204);
  });

  it('asks the URL it was given', async () => {
    const asked: string[] = [];
    const probe = createHttpProbe(async (url) => (asked.push(url), { status: 200, body: null }));
    await probe.status('http://x/api', 10, new AbortController().signal);
    expect(asked).toEqual(['http://x/api']);
  });

  it('rejects when nothing answers', async () => {
    const probe = createHttpProbe(async () => Promise.reject(new Error('connection refused')));
    await expect(probe.status('http://x/api', 10, new AbortController().signal)).rejects.toThrow('connection refused');
  });

  it('hands the fetch a signal that is aborted when the run is interrupted', async () => {
    const seen: AbortSignal[] = [];
    const probe = createHttpProbe(async (_url, init) => (seen.push(init.signal), { status: 200, body: null }));
    const interruption = new AbortController();
    await probe.status('http://x/api', 10_000, interruption.signal);
    expect(seen[0]?.aborted).toBe(false);
    interruption.abort();
    expect(seen[0]?.aborted).toBe(true);
  });
});
