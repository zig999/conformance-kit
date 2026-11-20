import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { createPortChecker, type IPortServer } from '../../src/shared/port-check.js';

class FakeServer extends EventEmitter implements IPortServer {
  readonly listened: { port: number; host: string }[] = [];
  closed = false;
  private readonly refusal: string | undefined;

  constructor(refusal?: string) {
    super();
    this.refusal = refusal;
  }

  listen(port: number, host: string, ready: () => void): void {
    this.listened.push({ port, host });
    if (this.refusal !== undefined) {
      this.emit('error', Object.assign(new Error('cannot listen'), { code: this.refusal }));
      return;
    }
    ready();
  }

  close(done: () => void): void {
    this.closed = true;
    done();
  }
}

describe('the port check', () => {
  it('says a port is free when the system lets it listen on all addresses, and gives it back', async () => {
    const server = new FakeServer();
    expect(await createPortChecker(() => server)(9000)).toBe(true);
    expect(server.listened).toEqual([{ port: 9000, host: '0.0.0.0' }]);
    expect(server.closed).toBe(true);
  });

  it.each(['EADDRINUSE', 'EACCES'])('says a port is not free when listening fails with %s', async (code) => {
    expect(await createPortChecker(() => new FakeServer(code))(9000)).toBe(false);
  });

  it('refuses to hide a failure that does not say anything about the port', async () => {
    await expect(createPortChecker(() => new FakeServer('EMFILE'))(9000)).rejects.toThrow(/cannot listen/);
  });
});
