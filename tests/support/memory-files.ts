import type { IFiles } from '../../src/shared/ports.js';

interface IEntry {
  readonly text: string;
  readonly mode: number | undefined;
}

interface IFailureRule {
  readonly operation: string;
  readonly pathPart: string;
  remaining: number;
}

export class MemoryFiles implements IFiles {
  readonly entries = new Map<string, IEntry>();
  readonly directories = new Map<string, number | undefined>();
  readonly removed: string[] = [];
  private readonly rules: IFailureRule[] = [];
  private counter = 0;

  seed(path: string, text: string): this {
    this.entries.set(path, { text, mode: undefined });
    return this;
  }

  /** Makes the operation fail for any path holding `pathPart`, the next `times` times (always, by default). */
  failOn(operation: keyof IFiles, pathPart: string, times = Number.POSITIVE_INFINITY): this {
    this.rules.push({ operation, pathPart, remaining: times });
    return this;
  }

  textOf(path: string): string | undefined {
    return this.entries.get(path)?.text;
  }

  modeOf(path: string): number | undefined {
    return this.entries.get(path)?.mode ?? this.directories.get(path);
  }

  private check(operation: keyof IFiles, path: string): void {
    const rule = this.rules.find(
      (candidate) => candidate.operation === operation && path.includes(candidate.pathPart) && candidate.remaining > 0,
    );
    if (rule !== undefined) {
      rule.remaining -= 1;
      throw new Error(`simulated failure of ${operation}`);
    }
  }

  async readText(path: string): Promise<string> {
    this.check('readText', path);
    const entry = this.entries.get(path);
    if (entry === undefined) {
      throw new Error(`no such file: ${path}`);
    }
    return entry.text;
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return Buffer.from(await this.readText(path), 'utf8');
  }

  async writeText(path: string, text: string): Promise<void> {
    this.check('writeText', path);
    this.entries.set(path, { text, mode: undefined });
  }

  async writePrivateText(path: string, text: string): Promise<void> {
    this.check('writePrivateText', path);
    this.entries.set(path, { text, mode: 0o600 });
  }

  async makePrivateDirectory(prefix: string): Promise<string> {
    this.check('makePrivateDirectory', prefix);
    this.counter += 1;
    const directory = `${prefix}${String(this.counter)}`;
    this.directories.set(directory, 0o700);
    return directory;
  }

  async makeDirectory(path: string, mode: number): Promise<void> {
    this.check('makeDirectory', path);
    this.directories.set(path, mode);
  }

  async removeTree(path: string): Promise<void> {
    this.check('removeTree', path);
    this.removed.push(path);
    for (const key of [...this.entries.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) {
        this.entries.delete(key);
      }
    }
    for (const key of [...this.directories.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) {
        this.directories.delete(key);
      }
    }
  }

  async exists(path: string): Promise<boolean> {
    this.check('exists', path);
    return this.entries.has(path) || this.directories.has(path);
  }

  async listFiles(path: string): Promise<readonly string[]> {
    this.check('listFiles', path);
    return [...this.entries.keys()].filter((key) => key.startsWith(`${path}/`));
  }
}
