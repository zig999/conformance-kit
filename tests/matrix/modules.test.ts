import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findModules } from '../../scripts/matrix/modules.js';
import { TemporaryRoot, validReport } from '../support/matrix-root.js';

describe('finding the modules under a root', () => {
  let root: TemporaryRoot;

  beforeEach(async () => {
    root = await TemporaryRoot.create();
  });

  afterEach(async () => {
    await root.remove();
  });

  it('takes a folder that has backend/package.json, whatever its name', async () => {
    await root.module('alpha');
    await root.module('beta');
    expect((await findModules(root.path, [])).map((module) => module.name)).toEqual(['alpha', 'beta']);
  });

  it('leaves out a folder with no backend, a backend with no package.json, and plain files', async () => {
    await root.module('alpha');
    await root.file('no-backend/readme.md', 'x');
    await root.file('half/backend/readme.md', 'x');
    await root.file('loose.md', 'x');
    expect((await findModules(root.path, [])).map((module) => module.name)).toEqual(['alpha']);
  });

  it('leaves out the folders it is told to exclude, and nothing else', async () => {
    await root.module('alpha');
    await root.module('out-of-scope');
    expect((await findModules(root.path, ['out-of-scope'])).map((module) => module.name)).toEqual(['alpha']);
  });

  it('lists only the files named conformance-report.json or conformance-report.<code>.json', async () => {
    await root.module('alpha', {
      'conformance-report.json': validReport(),
      'conformance-report.tmf671.json': validReport(),
      'conformance-report.txt': 'x',
      'conformance-report-old.json': '{}',
      'conformance-report.TMF637.json': '{}',
      'other.json': '{}',
      '.env': 'SECRET=never-read',
    });
    const [module] = await findModules(root.path, []);
    expect(module?.reportFiles).toEqual(['conformance-report.json', 'conformance-report.tmf671.json']);
  });

  it('answers a module with no report as having none', async () => {
    await root.module('alpha');
    expect((await findModules(root.path, []))[0]?.reportFiles).toEqual([]);
  });

  it('sorts the modules by name', async () => {
    for (const name of ['zeta', 'alpha', 'mid']) {
      await root.module(name);
    }
    expect((await findModules(root.path, [])).map((module) => module.name)).toEqual(['alpha', 'mid', 'zeta']);
  });
});
