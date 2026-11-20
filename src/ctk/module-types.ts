/** A command of the module: the migration, or the start of the module as a process. */
export interface IModuleCommand {
  readonly program: string;
  readonly args: readonly string[];
  readonly cwd?: string;
}

/** What the run hands to the module so that it can build its environment. The names of the variables are the module's. */
export interface IModuleRuntime {
  /** Where the module must listen so that the kit, which runs in docker, reaches it: all addresses. */
  readonly listenAddress: string;
  readonly port: number;
  /** The origin the kit uses to reach the module, which the module puts in the links it publishes. */
  readonly publicUrl: string;
  /** The variables the stand-ins publish, such as their addresses. */
  readonly standIns: Readonly<Record<string, string>>;
}

export interface IStandInHandle {
  /** Variables for the module (the address of the stand-in, for example). No secret is published here. */
  readonly environment: Readonly<Record<string, string>>;
  close(): Promise<void>;
}

/** A stand-in is a module that the module under test depends on and the kit does not bring. The module keeps it. */
export interface IStandIn {
  start(): Promise<IStandInHandle>;
}

/** CNF-13, mode `process`: the run applies the migration, starts the module on a free port and stops it. */
export interface IProcessModule {
  readonly mode: 'process';
  readonly migration?: IModuleCommand | undefined;
  readonly start: IModuleCommand;
  /** The base path of the API, asked to know the module is ready. */
  readonly apiBasePath: string;
  readonly environment: (runtime: IModuleRuntime) => Readonly<Record<string, string>>;
  readonly standIns?: readonly IStandIn[];
}

/** CNF-13, mode `compose`: the run starts a service of the `kit` profile of the module's compose and takes it down. */
export interface IComposeModule {
  readonly mode: 'compose';
  /** The directory of the compose project. */
  readonly directory: string;
  readonly service: string;
  readonly apiBasePath: string;
  readonly standIns?: readonly IStandIn[];
}

export type IModuleUnderTest = IProcessModule | IComposeModule;
