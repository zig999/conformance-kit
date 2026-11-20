import { join } from 'node:path';
import { KitDidNotRunError } from '../shared/errors.js';
import type { ICtkContext, KitReach } from './context.js';
import {
  COMPOSE_FILE,
  CONFIGURATION_FILE,
  ENVIRONMENT_FILE,
  KIT_SERVICE,
  OVERRIDE_FILE,
  REPORTS_DIRECTORY,
  emptyReports,
  type IWorkspace,
} from './docker-commands.js';
import { kitConfigurationFor } from './kit-configuration.js';

const DIRECTORY_PREFIX = 'conformance-kit-ctk-';
const REPORTS_MODE = 0o777;
const SUCCESS_EXIT_CODE = 0;

function overrideText(reach: KitReach, hostName: string): string {
  const extraHosts =
    reach.kind === 'process' ? `    extra_hosts:\n      - ${JSON.stringify(`${hostName}:host-gateway`)}\n` : '    {}\n';
  return `services:\n  ${KIT_SERVICE}:\n${extraHosts}`;
}

async function copyPrivately(ctx: ICtkContext, workspace: IWorkspace, name: string): Promise<void> {
  const { files } = ctx.effects;
  await files.writePrivateText(join(workspace.root, name), await files.readText(join(ctx.settings.kitDirectory, name)));
}

async function copyKitFiles(ctx: ICtkContext, workspace: IWorkspace, reach: KitReach): Promise<void> {
  const { files } = ctx.effects;
  const { kitDirectory, authorization } = ctx.settings;
  const kitText = await files.readText(join(kitDirectory, CONFIGURATION_FILE));
  const configuration = kitConfigurationFor(kitText, reach, authorization);
  await copyPrivately(ctx, workspace, COMPOSE_FILE);
  if (await files.exists(join(kitDirectory, ENVIRONMENT_FILE))) {
    await copyPrivately(ctx, workspace, ENVIRONMENT_FILE);
  }
  await files.writeReadableText(join(workspace.root, CONFIGURATION_FILE), configuration.text);
  await files.writePrivateText(join(workspace.root, OVERRIDE_FILE), overrideText(reach, configuration.hostName));
  await files.makeDirectory(workspace.reportsDirectory, REPORTS_MODE);
}

/**
 * The files the CTK writes in reports/ belong to the user of the container, and a folder it creates there may not
 * be removable by the user of the host. So reports/ goes first, alone: when it cannot be removed it is emptied by a
 * container as root, which needs the compose files of the copy, so nothing else may have been removed yet.
 */
async function removeWorkspace(ctx: ICtkContext, workspace: IWorkspace): Promise<void> {
  const { files, runner } = ctx.effects;
  try {
    await files.removeTree(workspace.reportsDirectory);
  } catch {
    const emptied = await runner.run(emptyReports(ctx.settings, workspace));
    if (emptied.exitCode !== SUCCESS_EXIT_CODE) {
      throw new KitDidNotRunError('reports/ of the private copy could not be emptied as root');
    }
  }
  await files.removeTree(workspace.root);
}

/**
 * CNF-12, step 4: a private copy of the kit (directory 0700), outside the repository, with the config.json that
 * holds the token. The folder of the kit is only read. The copy is removed at the teardown.
 *
 * Deviation from CNF-12, which says every file is 0600: the CTK runs as the user `app` (uid 10001) of its image
 * and could not read a 0600 config.json that belongs to the user of the host ("Permission denied", seen in the
 * real run). So the config.json is 0644; the 0700 directory is what keeps other users of the host from it. The
 * other files stay 0600. Recorded in CHANGELOG.md ("Execução real do CTK") and CLAUDE.md.
 */
export async function prepareWorkspace(ctx: ICtkContext, reach: KitReach, containerName: string): Promise<IWorkspace> {
  const { files, temporaryDirectory } = ctx.effects;
  const root = await files.makePrivateDirectory(join(temporaryDirectory, DIRECTORY_PREFIX));
  const workspace = { root, reportsDirectory: join(root, REPORTS_DIRECTORY), containerName };
  ctx.teardown.push('the private copy of the kit', () => removeWorkspace(ctx, workspace));
  try {
    await copyKitFiles(ctx, workspace, reach);
  } catch (cause) {
    throw new KitDidNotRunError('the private copy of the kit could not be prepared', {}, { cause });
  }
  return workspace;
}
