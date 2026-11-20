import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IFiles } from './ports.js';

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;
const ABSENT_CODES: readonly unknown[] = ['ENOENT', 'ENOTDIR'];

function isAbsent(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ABSENT_CODES.includes(error.code);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isAbsent(error)) {
      return false;
    }
    throw error;
  }
}

async function listFiles(path: string): Promise<readonly string[]> {
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

async function makeDirectory(path: string, mode: number): Promise<void> {
  await mkdir(path);
  await chmod(path, mode);
}

async function makePrivateDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(prefix);
  await chmod(directory, PRIVATE_DIRECTORY_MODE);
  return directory;
}

export function createNodeFiles(): IFiles {
  return {
    readText: (path) => readFile(path, 'utf8'),
    writeText: (path, text) => writeFile(path, text),
    writePrivateText: (path, text) => writeFile(path, text, { mode: PRIVATE_FILE_MODE }),
    makePrivateDirectory,
    makeDirectory,
    removeTree: (path) => rm(path, { recursive: true, force: true }),
    exists,
    listFiles,
  };
}
