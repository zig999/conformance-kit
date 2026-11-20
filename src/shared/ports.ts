export type Environment = Readonly<Record<string, string | undefined>>;

export interface ICommand {
  readonly program: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env: Environment;
  /** Only an interruptible command is stopped by SIGINT and SIGTERM. */
  readonly interruptible: boolean;
  readonly timeoutMillis?: number;
  /** Hands the output of the command to the output callback of the run. Auxiliary commands stay quiet. */
  readonly forwardOutput?: boolean;
}

export interface ICommandResult {
  readonly exitCode: number;
  readonly output: string;
}

export interface ICommandRunner {
  run(command: ICommand): Promise<ICommandResult>;
}

export interface IFiles {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, text: string): Promise<void>;
  writePrivateText(path: string, text: string): Promise<void>;
  makePrivateDirectory(prefix: string): Promise<string>;
  makeDirectory(path: string, mode: number): Promise<void>;
  removeTree(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(path: string): Promise<readonly string[]>;
}

export interface ISignalSource {
  on(name: NodeJS.Signals, handler: () => void): void;
  off(name: NodeJS.Signals, handler: () => void): void;
}

export interface IClock {
  now(): number;
  sleep(millis: number, signal?: AbortSignal): Promise<void>;
}
