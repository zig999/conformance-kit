import { createServer } from 'node:net';
import { KitDidNotRunError } from './errors.js';

const ANY_PORT = 0;
const ALL_ADDRESSES = '0.0.0.0';
const NO_FREE_PORT = 'the system gave no free port';

export interface IPortServer {
  once(event: 'error', listener: (error: Error) => void): unknown;
  listen(port: number, host: string, ready: () => void): unknown;
  address(): { readonly port: number } | string | null;
  close(done: () => void): unknown;
}

/** A port that is free on all addresses, because the module must listen where the kit, in docker, reaches it. */
export function createFreePortFinder(newServer: () => IPortServer = createServer): () => Promise<number> {
  return () =>
    new Promise<number>((resolve, reject) => {
      const probe = newServer();
      const refuse = (cause?: unknown): void =>
        reject(new KitDidNotRunError(NO_FREE_PORT, {}, cause === undefined ? undefined : { cause }));
      probe.once('error', refuse);
      probe.listen(ANY_PORT, ALL_ADDRESSES, () => {
        const address = probe.address();
        probe.close(() => (address === null || typeof address === 'string' ? refuse() : resolve(address.port)));
      });
    });
}
