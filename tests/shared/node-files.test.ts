import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeFiles } from '../../src/shared/node-files.js';

const PERMISSION_BITS = 0o777;
const modeOf = async (path: string): Promise<number> => (await stat(path)).mode & PERMISSION_BITS;

describe('the files of the kit', () => {
  let root = '';
  const files = createNodeFiles();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'conformance-kit-test-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('create a private directory with mode 0700', async () => {
    const directory = await files.makePrivateDirectory(join(root, 'work-'));
    expect(directory.startsWith(join(root, 'work-'))).toBe(true);
    expect(await modeOf(directory)).toBe(0o700);
  });

  it('write a private file with mode 0600', async () => {
    const path = join(root, 'secret.json');
    await files.writePrivateText(path, 'content');
    expect(await modeOf(path)).toBe(0o600);
    expect(await readFile(path, 'utf8')).toBe('content');
  });

  it('create a directory with the mode asked for', async () => {
    const path = join(root, 'reports');
    await files.makeDirectory(path, 0o777);
    expect(await modeOf(path)).toBe(0o777);
  });

  it('write and read plain text', async () => {
    const path = join(root, 'plain.txt');
    await files.writeText(path, 'plain');
    expect(await files.readText(path)).toBe('plain');
  });

  it('list the files of a tree, nested ones included, and no directory', async () => {
    await files.makeDirectory(join(root, 'a'), 0o700);
    await files.writeText(join(root, 'a', 'one.json'), '1');
    await files.writeText(join(root, 'two.json'), '2');
    expect((await files.listFiles(root)).toSorted()).toEqual([join(root, 'a', 'one.json'), join(root, 'two.json')]);
  });

  it('say whether a path exists', async () => {
    await files.writeText(join(root, 'here'), '');
    expect(await files.exists(join(root, 'here'))).toBe(true);
    expect(await files.exists(join(root, 'absent'))).toBe(false);
    await expect(files.exists(join(root, 'here', 'below'))).resolves.toBe(false);
  });

  it('remove a whole tree, and a tree that is already gone', async () => {
    await files.makeDirectory(join(root, 'tree'), 0o700);
    await files.writeText(join(root, 'tree', 'leaf'), '');
    await files.removeTree(join(root, 'tree'));
    expect(await files.exists(join(root, 'tree'))).toBe(false);
    await expect(files.removeTree(join(root, 'tree'))).resolves.toBeUndefined();
  });
});
