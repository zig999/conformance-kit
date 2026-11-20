import type { Environment, ICommand } from '../shared/ports.js';
import type { ICtkSettings } from './context.js';
import type { IComposeModule } from './module-types.js';
export declare const KIT_NETWORK = "tmf";
export declare const KIT_SERVICE = "ctk";
export declare const MODULE_PROFILE = "kit";
export declare const COMPOSE_FILE = "docker-compose.yaml";
export declare const OVERRIDE_FILE = "compose.override.yaml";
export declare const CONFIGURATION_FILE = "config.json";
export declare const ENVIRONMENT_FILE = ".env";
export declare const REPORTS_DIRECTORY = "reports";
export interface IWorkspace {
    readonly root: string;
    readonly reportsDirectory: string;
    readonly containerName: string;
}
interface IStepSettings {
    readonly environment: Environment;
    readonly stepTimeoutMillis: number;
}
export declare const dockerInfo: (settings: IStepSettings) => ICommand;
export declare const networkInspect: (settings: IStepSettings) => ICommand;
export declare const networkCreate: (settings: IStepSettings) => ICommand;
export declare const networkRemove: (settings: IStepSettings) => ICommand;
/** CNF-12, step 5: `docker compose run -T --rm --name <unique name> ctk`, in the private copy. */
export declare function kitRun(settings: ICtkSettings, workspace: IWorkspace): ICommand;
export declare function kitContainers(settings: IStepSettings, name: string): ICommand;
export declare function kitContainerRemove(settings: IStepSettings, name: string): ICommand;
/** CNF-12, step 4: empties reports/ as root, for files that belong to the user of the container. */
export declare function emptyReports(settings: IStepSettings, workspace: IWorkspace): ICommand;
export declare function composeServices(settings: IStepSettings, directory: string): ICommand;
/** `docker compose --profile kit up -d --build --wait <service>`, with the variables the stand-ins publish. */
export declare function modulesUp(settings: ICtkSettings, module: IComposeModule, env: Environment): ICommand;
export declare function modulesDown(settings: ICtkSettings, module: IComposeModule, env: Environment): ICommand;
export {};
