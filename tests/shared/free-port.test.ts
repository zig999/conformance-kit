import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { createFreePortFinder, type IPortServer } from '../../src/shared/free-port.js';

class FakeServer extends EventEmitter implements IPortServer {
  readonly listened: { port: number; host: string }[] = [];
  closed = false;

  private readonly reply: 'a port' | 'a pipe' | 'nothing' | 'an error';
  private readonly port: number;

  constructor(reply: 'a port' | 'a pipe' | 'nothing' | 'an error', port = 40123) {
    super();
    this.reply = reply;
    this.port = port;
  }

  listen(port: number, host: string, ready: () => void): void {
    this.listened.push({ port, host });
    if (this.reply === 'an error') {
      this.emit('error', new Error('address in use'));
      return;
    }
    ready();
  }

  address(): { port: number } | string | null {
    return this.reply === 'a port' ? { port: this.port } : this.reply === 'a pipe' ? '/tmp/pipe' : null;
  }

  close(done: () => void): void {
    this.closed = true;
    done();
  }
}

describe('the free port', () => {
  it('asks the system for a port on all addresses, and gives it back', async () => {
    const server = new FakeServer('a port');
    expect(await createFreePortFinder(() => server)()).toBe(40123);
    expect(server.listened).toEqual([{ port: 0, host: '0.0.0.0' }]);
    expect(server.closed).toBe(true);
  });

  it.each(['a pipe', 'nothing'] as const)('refuses an address that is %s', async (reply) => {
    await expect(createFreePortFinder(() => new FakeServer(reply))()).rejects.toThrow(/free port/);
  });

  it('rejects when the system cannot listen', async () => {
    await expect(createFreePortFinder(() => new FakeServer('an error'))()).rejects.toThrow(/free port/);
  });
});
