import type { Environment, ICommand } from '../shared/ports.js';
import type { ICtkSettings } from './context.js';
import type { IComposeModule } from './module-types.js';

export const KIT_NETWORK = 'tmf';
export const KIT_SERVICE = 'ctk';
export const MODULE_PROFILE = 'kit';
export const COMPOSE_FILE = 'docker-compose.yaml';
export const OVERRIDE_FILE = 'compose.override.yaml';
export const CONFIGURATION_FILE = 'config.json';
export const ENVIRONMENT_FILE = '.env';
export const REPORTS_DIRECTORY = 'reports';

const DOCKER = 'docker';
const ROOT_USER = '0';
const CONTAINER_REPORTS = '/reports';
const MILLIS_PER_SECOND = 1000;

export interface IWorkspace {
  readonly root: string;
  readonly reportsDirectory: string;
  readonly containerName: string;
}

interface IStepSettings {
  readonly environment: Environment;
  readonly stepTimeoutMillis: number;
}

function docker(settings: IStepSettings, args: readonly string[], extra: Partial<ICommand> = {}): ICommand {
  return {
    program: DOCKER,
    args,
    env: settings.environment,
    interruptible: false,
    timeoutMillis: settings.stepTimeoutMillis,
    ...extra,
  };
}

export const dockerInfo = (settings: IStepSettings): ICommand => docker(settings, ['info']);
export const networkInspect = (settings: IStepSettings): ICommand =>
  docker(settings, ['network', 'inspect', KIT_NETWORK]);
export const networkCreate = (settings: IStepSettings): ICommand =>
  docker(settings, ['network', 'create', KIT_NETWORK]);
export const networkRemove = (settings: IStepSettings): ICommand => docker(settings, ['network', 'rm', KIT_NETWORK]);

function composeInWorkspace(workspace: IWorkspace): string[] {
  return [
    'compose',
    '--project-directory',
    workspace.root,
    '-f',
    `${workspace.root}/${COMPOSE_FILE}`,
    '-f',
    `${workspace.root}/${OVERRIDE_FILE}`,
  ];
}

/** CNF-12, step 5: `docker compose run -T --rm --name <unique name> ctk`, in the private copy. */
export function kitRun(settings: ICtkSettings, workspace: IWorkspace): ICommand {
  const run = ['run', '-T', '--rm', '--name', workspace.containerName, KIT_SERVICE];
  return docker(settings, [...composeInWorkspace(workspace), ...run], {
    interruptible: true,
    timeoutMillis: settings.runTimeoutMillis,
    forwardOutput: true,
  });
}

export function kitContainers(settings: IStepSettings, name: string): ICommand {
  return docker(settings, ['ps', '-a', '-q', '--filter', `name=^${name}$`]);
}

export function kitContainerRemove(settings: IStepSettings, name: string): ICommand {
  return docker(settings, ['rm', '-f', name]);
}

/** CNF-12, step 4: empties reports/ as root, for files that belong to the user of the container. */
export function emptyReports(settings: IStepSettings, workspace: IWorkspace): ICommand {
  const emptying = ['run', '-T', '--rm', '--no-deps', '--user', ROOT_USER, '--entrypoint', 'find'];
  const name = ['--name', `${workspace.containerName}-emptying`, KIT_SERVICE];
  const find = [CONTAINER_REPORTS, '-mindepth', '1', '-delete'];
  return docker(settings, [...composeInWorkspace(workspace), ...emptying, ...name, ...find]);
}

export function composeServices(settings: IStepSettings, directory: string): ICommand {
  return docker(settings, ['compose', '--profile', MODULE_PROFILE, 'ps', '-q'], { cwd: directory });
}

/** `docker compose --profile kit up -d --build --wait <service>`, with the variables the stand-ins publish. */
export function modulesUp(settings: ICtkSettings, module: IComposeModule, env: Environment): ICommand {
  const seconds = String(Math.ceil(settings.startTimeoutMillis / MILLIS_PER_SECOND));
  const wait = ['--wait', '--wait-timeout', seconds];
  const args = ['compose', '--profile', MODULE_PROFILE, 'up', '-d', '--build', ...wait, module.service];
  return docker(settings, args, {
    cwd: module.directory,
    env,
    interruptible: true,
    timeoutMillis: settings.startTimeoutMillis,
  });
}

export function modulesDown(settings: ICtkSettings, module: IComposeModule, env: Environment): ICommand {
  const args = ['compose', '--profile', MODULE_PROFILE, 'down', '--remove-orphans'];
  return docker(settings, args, { cwd: module.directory, env });
}
