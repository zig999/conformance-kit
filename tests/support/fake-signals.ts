import type { ISignalSource } from '../../src/shared/ports.js';

export class FakeSignals implements ISignalSource {
  private readonly handlers = new Map<NodeJS.Signals, Set<() => void>>();

  on(name: NodeJS.Signals, handler: () => void): void {
    this.handlers.set(name, new Set([...(this.handlers.get(name) ?? []), handler]));
  }

  off(name: NodeJS.Signals, handler: () => void): void {
    this.handlers.get(name)?.delete(handler);
  }

  listenerCount(): number {
    return [...this.handlers.values()].reduce((total, set) => total + set.size, 0);
  }

  raise(name: NodeJS.Signals): void {
    [...(this.handlers.get(name) ?? [])].forEach((handler) => handler());
  }
}
