import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = new URL('../../scripts/release.sh', import.meta.url).pathname;

const PNPM_STUB = `#!/bin/sh
echo "$@" >> "$STUB_LOG"
case "$1" in build) mkdir -p dist; echo built > dist/index.js;; esac
[ "\${PNPM_FAIL:-}" = "$1" ] && exit 1
exit 0
`;
const NPM_STUB = `#!/bin/sh
[ -n "\${NPM_FAIL:-}" ] && exit 1
version="\${3#version=}"
sed -i.bak "s/\\"version\\": \\"[^\\"]*\\"/\\"version\\": \\"$version\\"/" package.json
rm -f package.json.bak
`;

interface IRelease {
  readonly status: number | null;
  readonly stderr: string;
}

describe('the release script', () => {
  let repo = '';
  let stubs = '';

  const git = (...args: string[]): string => {
    const run = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    return run.stdout.trim();
  };

  const release = (version: string, extra: Record<string, string> = {}): IRelease => {
    const run = spawnSync('sh', [join(repo, 'release.sh'), version], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${stubs}:${process.env['PATH'] ?? ''}`, STUB_LOG: join(stubs, 'log'), ...extra },
    });
    return { status: run.status, stderr: run.stderr };
  };

  const commitAll = (message: string): void => {
    git('add', '-A');
    git('commit', '-q', '-m', message);
  };

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'conformance-kit-release-'));
    stubs = await mkdtemp(join(tmpdir(), 'conformance-kit-stubs-'));
    await writeFile(join(stubs, 'pnpm'), PNPM_STUB);
    await writeFile(join(stubs, 'npm'), NPM_STUB);
    await writeFile(join(stubs, 'log'), '');
    await chmod(join(stubs, 'pnpm'), 0o755);
    await chmod(join(stubs, 'npm'), 0o755);
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.test');
    git('config', 'commit.gpgsign', 'false');
    await copyFile(SCRIPT, join(repo, 'release.sh'));
    await writeFile(join(repo, 'package.json'), '{\n  "name": "x",\n  "version": "0.0.0"\n}\n');
    await writeFile(join(repo, '.gitignore'), 'dist/\nrelease.sh.keep\n');
    await writeFile(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## v0.1.1 (2026-11-20)\n\nSomething.\n');
    await mkdir(join(repo, 'src'));
    commitAll('first');
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
    await rm(stubs, { recursive: true, force: true });
  });

  const calls = async (): Promise<string[]> => (await readFile(join(stubs, 'log'), 'utf8')).split('\n').filter(Boolean);
  const version = async (ref: string): Promise<string> => JSON.parse(git('show', `${ref}:package.json`)).version;

  it('creates the tag on a release commit that holds the compiled dist, and leaves main as it was', async () => {
    expect(release('0.1.1').status).toBe(0);
    expect(git('tag')).toBe('v0.1.1');
    expect(await version('v0.1.1')).toBe('0.1.1');
    expect(git('ls-tree', '-r', 'v0.1.1', '--name-only').split('\n')).toContain('dist/index.js');
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(await version('main')).toBe('0.0.0');
    expect(git('ls-tree', '-r', 'main', '--name-only').split('\n')).not.toContain('dist/index.js');
    expect(git('status', '--porcelain')).toBe('');
  });

  it('runs the verifications and the build before it touches git', async () => {
    release('0.1.1');
    expect((await calls()).map((line) => line.split(' ')[0])).toEqual([
      'typecheck',
      'lint',
      'format',
      'test',
      'duplication',
      'build',
    ]);
  });

  it('refuses a version that the CHANGELOG has no entry for, before it runs anything', async () => {
    const run = release('0.2.0');
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('CHANGELOG.md');
    expect(run.stderr).toContain('## v0.2.0');
    expect(git('tag')).toBe('');
    expect(await calls()).toEqual([]);
  });

  it('does not take the entry of another version for this one', async () => {
    await writeFile(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## v0.1.10 (2026-11-20)\n\nSomething.\n');
    commitAll('changelog');
    expect(release('0.1.1').status).not.toBe(0);
    expect(git('tag')).toBe('');
  });

  it('accepts a heading that is only the version', async () => {
    await writeFile(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## v0.1.1\n\nSomething.\n');
    commitAll('changelog');
    expect(release('0.1.1').status).toBe(0);
  });

  it('refuses a branch other than main', () => {
    git('checkout', '-q', '-b', 'other');
    expect(release('0.1.1').status).not.toBe(0);
    expect(git('tag')).toBe('');
  });

  it('refuses a working tree with changes', async () => {
    await writeFile(join(repo, 'src', 'dirty.ts'), 'x');
    expect(release('0.1.1').status).not.toBe(0);
    expect(git('tag')).toBe('');
  });

  it('refuses a tag that exists, and does not move it', () => {
    git('tag', 'v0.1.1');
    const before = git('rev-parse', 'v0.1.1');
    expect(release('0.1.1').status).not.toBe(0);
    expect(git('rev-parse', 'v0.1.1')).toBe(before);
  });

  it('stops at a verification that fails, with nothing changed', async () => {
    const run = release('0.1.1', { PNPM_FAIL: 'test' });
    expect(run.status).not.toBe(0);
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git('tag')).toBe('');
    expect((await calls()).some((line) => line.startsWith('build'))).toBe(false);
  });

  it('puts the repository back on main, clean, when it fails after leaving it', async () => {
    const run = release('0.1.1', { NPM_FAIL: '1' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/de volta a main/);
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git('status', '--porcelain')).toBe('');
    expect(await version('main')).toBe('0.0.0');
    expect(git('tag')).toBe('');
  });

  it('does the same when the commit fails, and leaves nothing staged', async () => {
    await writeFile(join(repo, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n');
    await chmod(join(repo, '.git', 'hooks', 'pre-commit'), 0o755);
    const run = release('0.1.1');
    expect(run.status).not.toBe(0);
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git('status', '--porcelain')).toBe('');
    expect(git('diff', '--cached', '--name-only')).toBe('');
    expect(await readFile(join(repo, 'package.json'), 'utf8')).toContain('"version": "0.0.0"');
    expect(git('tag')).toBe('');
  });
});
