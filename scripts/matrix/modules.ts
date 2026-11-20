import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const REPORT_FILE = /^conformance-report(\.[a-z0-9]+)?\.json$/;

export interface IModuleFolder {
  readonly name: string;
  /** The names of the conformance-report*.json files in its backend/, sorted. */
  readonly reportFiles: readonly string[];
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function reportFilesOf(backend: string): Promise<string[]> {
  const entries = await readdir(backend, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && REPORT_FILE.test(entry.name))
    .map((entry) => entry.name)
    .toSorted();
}

/**
 * A module is a folder of the root with backend/package.json (only its existence is checked). The script knows
 * no module by name: what is not a module of the standard is left out by the `excluded` argument of the operator.
 */
export async function findModules(root: string, excluded: readonly string[]): Promise<IModuleFolder[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory() && !excluded.includes(entry.name));
  const modules: IModuleFolder[] = [];
  for (const folder of folders.toSorted((first, second) => first.name.localeCompare(second.name))) {
    const backend = join(root, folder.name, 'backend');
    if (await isFile(join(backend, 'package.json'))) {
      modules.push({ name: folder.name, reportFiles: await reportFilesOf(backend) });
    }
  }
  return modules;
}

export function apiCodeOfFile(fileName: string): string | undefined {
  const suffix = REPORT_FILE.exec(fileName)?.[1];
  return suffix === undefined ? undefined : suffix.slice(1).toUpperCase();
}
