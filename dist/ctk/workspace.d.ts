import type { ICtkContext, KitReach } from './context.js';
import { type IWorkspace } from './docker-commands.js';
/**
 * CNF-12, step 4: a private copy of the kit (directory 0700), outside the repository, with the config.json that
 * holds the token. The folder of the kit is only read. The copy is removed at the teardown.
 *
 * Deviation from CNF-12, which says every file is 0600: the CTK runs as the user `app` (uid 10001) of its image
 * and could not read a 0600 config.json that belongs to the user of the host ("Permission denied", seen in the
 * real run). So the config.json is 0644; the 0700 directory is what keeps other users of the host from it. The
 * other files stay 0600. Recorded in PLANO.md, section 9.
 */
export declare function prepareWorkspace(ctx: ICtkContext, reach: KitReach, containerName: string): Promise<IWorkspace>;
