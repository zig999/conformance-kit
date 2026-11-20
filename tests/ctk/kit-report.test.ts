import { describe, expect, it } from 'vitest';
import { failedIdentifiers, readKitItems } from '../../src/ctk/kit-report.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import {
  answered,
  failedTest,
  mochaReport,
  newmanReport,
  passedTest,
  type IMochaTest,
} from '../support/ctk-reports.js';
import { MemoryFiles } from '../support/memory-files.js';

const REPORTS = '/work/reports';

const readFrom = async (...documents: string[]) => {
  const files = new MemoryFiles();
  documents.forEach((text, position) => files.seed(`${REPORTS}/report-${String(position)}.json`, text));
  return readKitItems(files, REPORTS);
};

const mochaItem = async (test: IMochaTest) => (await readFrom(mochaReport({ tests: [test] })))[0];

describe('reading a Mocha report', () => {
  it('reads a test that passed', async () => {
    expect(await mochaItem(passedTest('GET /product returns 200'))).toEqual({
      identifier: 'GET /product returns 200',
      passed: true,
    });
  });

  it('reads a test that failed', async () => {
    expect(await mochaItem(failedTest('GET /product returns 200'))).toEqual({
      identifier: 'GET /product returns 200',
      passed: false,
    });
  });

  it.each([
    ['pending', { title: 'a', state: 'passed', pending: true }],
    ['skipped', { title: 'a', state: 'passed', skipped: true }],
    ['marked as failed', { title: 'a', state: 'passed', fail: true }],
    ['without a state', { title: 'a' }],
    ['pending by state', { title: 'a', state: 'pending' }],
  ])('does not count a test that is %s as passed', async (_name, test) => {
    expect((await mochaItem(test))?.passed).toBe(false);
  });

  it('names the item by its full title, and by its title when there is no full title', async () => {
    const items = await readFrom(
      mochaReport({
        tests: [
          { title: 'short', fullTitle: 'suite short', state: 'passed' },
          { title: 'only title', state: 'passed' },
        ],
      }),
    );
    expect(items.map((item) => item.identifier)).toEqual(['suite short', 'only title']);
  });

  it('ignores hooks', async () => {
    const items = await readFrom(
      mochaReport({ tests: [{ title: 'before all hook', state: 'failed', isHook: true }, passedTest('real')] }),
    );
    expect(items).toEqual([{ identifier: 'real', passed: true }]);
  });

  it('reads nested suites', async () => {
    const items = await readFrom(
      mochaReport({ tests: [passedTest('top')], suites: [{ suites: [{ tests: [failedTest('deep')] }] }] }),
    );
    expect(items).toEqual([
      { identifier: 'top', passed: true },
      { identifier: 'deep', passed: false },
    ]);
  });
});

describe('reading a Newman report', () => {
  it('passes an item that was answered with all assertions run and passed', async () => {
    const items = await readFrom(newmanReport(answered('create product', [{}, { error: null }])));
    expect(items).toEqual([{ identifier: 'create product', passed: true }]);
  });

  it('passes an answered item that has no assertion', async () => {
    expect((await readFrom(newmanReport(answered('list'))))[0]?.passed).toBe(true);
  });

  it('fails an item that has no response', async () => {
    const items = await readFrom(newmanReport({ item: { name: 'silent' }, assertions: [] }));
    expect(items).toEqual([{ identifier: 'silent', passed: false }]);
  });

  it('fails an item with a request error', async () => {
    const items = await readFrom(
      newmanReport({ item: { name: 'broken' }, response: { code: 200 }, requestError: { message: 'refused' } }),
    );
    expect(items[0]?.passed).toBe(false);
  });

  it('fails an item with a skipped assertion', async () => {
    expect((await readFrom(newmanReport(answered('skipped', [{ skipped: true }]))))[0]?.passed).toBe(false);
  });

  it('fails an item with a failed assertion', async () => {
    const items = await readFrom(newmanReport(answered('wrong', [{}, { error: { message: 'expected 201' } }])));
    expect(items[0]?.passed).toBe(false);
  });

  it('names the item by item.name exactly as reported', async () => {
    expect((await readFrom(newmanReport(answered('  Spaced  Name '))))[0]?.identifier).toBe('  Spaced  Name ');
  });
});

describe('reading a folder of reports', () => {
  it('joins the items of several files, in both formats', async () => {
    const items = await readFrom(mochaReport({ tests: [passedTest('a')] }), newmanReport(answered('b')));
    expect(items.map((item) => item.identifier)).toEqual(['a', 'b']);
  });

  it('reads only the files that end in .json', async () => {
    const files = new MemoryFiles()
      .seed(`${REPORTS}/index.html`, '<html></html>')
      .seed(`${REPORTS}/data.json`, mochaReport({ tests: [passedTest('a')] }));
    expect(await readKitItems(files, REPORTS)).toHaveLength(1);
  });

  it('refuses a folder without a report', async () => {
    const files = new MemoryFiles().seed(`${REPORTS}/index.html`, '<html></html>');
    await expect(readKitItems(files, REPORTS)).rejects.toBeInstanceOf(KitDidNotRunError);
  });

  it('refuses a report with no item', async () => {
    await expect(readFrom(mochaReport({ tests: [] }))).rejects.toThrow(/no result of any item/);
  });

  it('refuses a file that is not JSON, naming the file', async () => {
    await expect(readFrom('not json')).rejects.toThrow(/report-0\.json/);
  });

  it('refuses a JSON document of another shape, as a report with no item', async () => {
    await expect(readFrom('{"other": true}')).rejects.toBeInstanceOf(KitDidNotRunError);
  });
});

describe('the failed identifiers', () => {
  it('lists each failed item once', () => {
    const items = [
      { identifier: 'a', passed: false },
      { identifier: 'b', passed: true },
      { identifier: 'a', passed: false },
    ];
    expect(failedIdentifiers(items)).toEqual(['a']);
  });
});
