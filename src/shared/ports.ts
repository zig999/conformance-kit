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
  /** Stdout and stderr together, in the order they came: for reading by a person. */
  readonly output: string;
  /** Stdout alone: what a command answers, free of the warnings it prints on stderr. Judge a listing by this. */
  readonly stdout: string;
  /** The command ran out of its `timeoutMillis` and was killed. Whatever it left behind is not a finished run. */
  readonly timedOut: boolean;
}

export interface ICommandRunner {
  run(command: ICommand): Promise<ICommandResult>;
}

export interface IFiles {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, text: string): Promise<void>;
  writePrivateText(path: string, text: string): Promise<void>;
  /** A file with mode 0644: for the one file the container of the kit, which runs as another user, must read. */
  writeReadableText(path: string, text: string): Promise<void>;
  makePrivateDirectory(prefix: string): Promise<string>;
  makeDirectory(path: string, mode: number): Promise<void>;
  removeTree(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(path: string): Promise<readonly string[]>;
}

export interface ISignalSource {
  on(name: NodeJS.Signals, handler: () => void): void;
  off(name: NodeJS.Signals, handler: () => void): void;
  /** Sends the signal to the process itself. Used once the handlers are gone, to let its default action happen. */
  sendToSelf(name: NodeJS.Signals): void;
}

export interface IClock {
  now(): number;
  sleep(millis: number, signal?: AbortSignal): Promise<void>;
}

/** Asks a URL for its status. It rejects when nothing answers. */
export interface IHttpProbe {
  status(url: string, timeoutMillis: number, signal: AbortSignal): Promise<number>;
}
