import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { findModules } from './modules.js';
import { renderMatrix } from './render.js';
import { rowsOfModule, type IMatrixRow } from './rows.js';

const OUTPUT_FILE = 'matriz-conformidade.md';
const FLAG_AND_VALUE = 2;

export interface IMatrixOptions {
  /** The root that holds the modules: the folder above the repository of the kit. */
  readonly root: string;
  readonly output: string;
  readonly excluded: readonly string[];
}

/** Reads every conformance-report*.json under the root, validates it with the schema of the kit and writes the matrix. */
export async function generateMatrix(options: IMatrixOptions): Promise<IMatrixRow[]> {
  const modules = await findModules(options.root, options.excluded);
  const rows = (await Promise.all(modules.map((module) => rowsOfModule(options.root, module)))).flat();
  await writeFile(options.output, renderMatrix(rows, options.excluded));
  return rows;
}

function valueAfter(args: readonly string[], position: number, flag: string): string {
  const value = args[position + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`missing value for argument ${flag}`);
  }
  return value;
}

/** `--root <dir>`, `--output <file>` and any number of `--exclude <folder>`. The root defaults to the folder above the repository. */
export function parseArguments(args: readonly string[], scriptsDirectory: string): IMatrixOptions {
  let root = resolve(scriptsDirectory, '..', '..');
  let output: string | undefined;
  const excluded: string[] = [];
  for (let position = 0; position < args.length; position += FLAG_AND_VALUE) {
    const flag = args[position] ?? '';
    const value = valueAfter(args, position, flag);
    if (flag === '--root') {
      root = value;
    } else if (flag === '--output') {
      output = value;
    } else if (flag === '--exclude') {
      excluded.push(value);
    } else {
      throw new Error(`unknown or unexpected argument ${flag}`);
    }
  }
  return { root, output: output ?? join(root, OUTPUT_FILE), excluded };
}
