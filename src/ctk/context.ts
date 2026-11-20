import type { IRunEffects } from '../shared/effects.js';
import type { Environment } from '../shared/ports.js';
import type { Teardown } from '../shared/teardown.js';

export interface ICtkSettings {
  readonly kitDirectory: string;
  /** The whole value of the Authorization header, with its scheme. It is a secret. */
  readonly authorization: string;
  /** The origin of CONFORMANCE_SERVICE_URL, as the machine that runs the command reaches the module. */
  readonly serviceUrl: string;
  readonly startTimeoutMillis: number;
  readonly runTimeoutMillis: number;
  readonly stepTimeoutMillis: number;
  /** The environment of every command: the one the module gave, without the CONFORMANCE_* variables. */
  readonly environment: Environment;
}

export interface ICtkContext {
  readonly effects: IRunEffects;
  readonly settings: ICtkSettings;
  readonly teardown: Teardown;
  readonly signal: AbortSignal;
}

/** How the kit reaches the module: a process on the host, or a service of the compose in the same network. */
export type KitReach =
  | { readonly kind: 'process'; readonly port: number }
  | { readonly kind: 'compose'; readonly host: string; readonly port: number };
