import { describe, expect, it } from 'vitest';
import { failedIdentifiers, readKitItems } from '../../src/ctk/kit-report.js';
import { KitDidNotRunError } from '../../src/shared/errors.js';
import {
  answered,
  failedTest,
  mochaDocument,
  mochaReport,
  newmanDocument,
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

  it('ignores a hook that passed: it is not an item', async () => {
    const items = await readFrom(
      mochaReport({ tests: [{ title: 'before all hook', state: 'passed', isHook: true }, passedTest('real')] }),
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

describe('the identifier of an item', () => {
  const REAL_TITLE =
    'Tests method POST and path /product  TMF637 Conformance Profile v5.0.0 - API POST Operation Conformance - For Product Resource Tests status \n\n\t\t\t\tEndPoint: http://tmf637-ri:9137/tmf-api/productInventoryManagement/v5';
  const NORMALIZED =
    'Tests method POST and path /product TMF637 Conformance Profile v5.0.0 - API POST Operation Conformance - For Product Resource Tests status EndPoint: http://tmf637-ri:9137/tmf-api/productInventoryManagement/v5';

  it('has its runs of white space, line breaks and tabs made one space, and its ends trimmed, as the kit reports it', async () => {
    expect((await mochaItem(passedTest(REAL_TITLE)))?.identifier).toBe(NORMALIZED);
  });

  it('is normalized for an item of a Newman report too', async () => {
    expect((await readFrom(newmanReport(answered(`  ${REAL_TITLE}\n`))))[0]?.identifier).toBe(NORMALIZED);
  });

  it('makes two titles that differ only in white space one identifier', async () => {
    const items = await readFrom(mochaReport({ tests: [failedTest('a  b'), failedTest('a\n\tb')] }));
    expect(failedIdentifiers(items)).toEqual(['a b']);
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

  it('names the item by item.name', async () => {
    expect((await readFrom(newmanReport(answered('Create product'))))[0]?.identifier).toBe('Create product');
  });
});

describe('a hook that failed', () => {
  const hook = (overrides: Record<string, unknown> = {}): IMochaTest => ({
    title: '"before all" hook',
    fullTitle: 'Suite "before all" hook',
    state: 'failed',
    fail: true,
    isHook: true,
    ...overrides,
  });

  it('means the kit did not run to the end, because the tests after it never ran', async () => {
    const reading = readFrom(mochaReport({ tests: [passedTest('before it'), hook()] }));
    await expect(reading).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(reading).rejects.toThrow(/hook/);
  });

  it('names the hook, as the kit reports it with its white space made one space', async () => {
    const reading = readFrom(
      mochaReport({ tests: [passedTest('a'), hook({ fullTitle: 'Suite\n\t"before all" hook' })] }),
    );
    await expect(reading).rejects.toThrow('Suite "before all" hook');
  });

  it.each(['beforeHooks', 'afterHooks'])('is found in %s of a suite, and in a nested suite', async (key) => {
    const document = mochaDocument([
      { tests: [passedTest('a')], suites: [{ tests: [passedTest('b')], [key]: [hook()] }] },
    ]);
    await expect(readFrom(document)).rejects.toBeInstanceOf(KitDidNotRunError);
  });

  it('is found when it is marked as failed without a state', async () => {
    await expect(
      readFrom(mochaReport({ tests: [passedTest('a'), hook({ state: undefined })] })),
    ).rejects.toBeInstanceOf(KitDidNotRunError);
  });

  it('is not an error when the hook passed or is pending, and it is still not an item', async () => {
    const items = await readFrom(
      mochaDocument([
        {
          tests: [passedTest('a'), hook({ state: 'passed', fail: false })],
          beforeHooks: [hook({ state: 'passed', fail: false }), hook({ state: 'pending', fail: false })],
          afterHooks: ['a-uuid-of-a-hook'],
        },
      ]),
    );
    expect(items).toEqual([{ identifier: 'a', passed: true }]);
  });
});

describe('the failures of a Newman run', () => {
  const withFailures = (failures: unknown[], ...names: string[]): string =>
    newmanDocument(
      names.map((name) => ({ item: { name }, response: { code: 200 }, assertions: [] })),
      { failures },
    );

  it('turn the item they name into a failed one, even when all its assertions passed', async () => {
    const items = await readFrom(
      withFailures([{ source: { name: 'create product' }, error: { message: 'boom' } }], 'create product', 'list'),
    );
    expect(failedIdentifiers(items)).toEqual(['create product']);
  });

  it('count as a failed item with a name of their own when they name none', async () => {
    const items = await readFrom(withFailures([{ error: { message: 'script error' } }], 'list'));
    expect(failedIdentifiers(items)).toEqual(['Newman failure with no item']);
  });

  it('normalize the name of the item as for any other item', async () => {
    const items = await readFrom(withFailures([{ source: { name: 'create\n\tproduct' } }], 'create product'));
    expect(failedIdentifiers(items)).toEqual(['create product']);
  });

  it('are nothing when the list is empty or absent', async () => {
    expect(failedIdentifiers(await readFrom(withFailures([], 'list')))).toEqual([]);
    expect(failedIdentifiers(await readFrom(newmanReport(answered('list'))))).toEqual([]);
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

  it('refuses a JSON document that is neither a Mocha nor a Newman report, naming the file', async () => {
    const reading = readFrom('{"other": true}');
    await expect(reading).rejects.toBeInstanceOf(KitDidNotRunError);
    await expect(reading).rejects.toThrow(/report-0\.json.*neither/);
  });

  it('refuses the whole folder when one file is of another shape, even if the others are fine', async () => {
    const reading = readFrom(mochaReport({ tests: [passedTest('a')] }), '{"other": true}');
    await expect(reading).rejects.toThrow(/neither/);
  });
});

describe('the totals a report declares', () => {
  const rejects = (document: string, message: RegExp) => expect(readFrom(document)).rejects.toThrow(message);
  const two = { tests: [passedTest('a'), failedTest('b')] };

  it('hold for a Mocha report whose items agree with its stats', async () => {
    expect(await readFrom(mochaDocument([two]))).toHaveLength(2);
  });

  it('are required of a Mocha report: without stats the kit cannot know that every test is there', async () => {
    await rejects(mochaDocument([two], null), /no totals/);
  });

  it('refuse a Mocha report with fewer tests than it declares', async () => {
    await rejects(mochaDocument([two], { tests: 3 }), /declares 3 tests.*holds 2/);
  });

  it('refuse a Mocha report with more tests registered than ran, which is what a failed hook leaves behind', async () => {
    await rejects(mochaDocument([two], { testsRegistered: 5 }), /registered 5.*ran 2/);
  });

  it('refuse a Mocha report that declares more passes than the items passed', async () => {
    await rejects(mochaDocument([two], { passes: 2 }), /declares 2 passes.*1/);
  });

  it('refuse a Mocha report that declares more failures than the items failed', async () => {
    await rejects(mochaDocument([two], { failures: 4 }), /declares 4 failures.*1/);
  });

  it('refuse a Mocha report that declares fewer failures than the items failed, whatever the cause', async () => {
    await rejects(mochaDocument([two], { failures: 0 }), /declares 0 failures.*1/);
  });

  it('are checked in every file, the merged one and the single one alike', async () => {
    const reading = readFrom(mochaDocument([two]), mochaDocument([two], { tests: 9 }));
    await expect(reading).rejects.toThrow(/report-1\.json/);
  });

  it('hold for a Newman report whose executions agree with its stats', async () => {
    expect(await readFrom(newmanDocument([answered('a', [{}, { error: { message: 'x' } }])]))).toHaveLength(1);
  });

  it('are required of a Newman report', async () => {
    await rejects(newmanDocument([answered('a')], { stats: null }), /no totals/);
  });

  it('refuse a Newman report with fewer requests than it declares', async () => {
    await rejects(
      newmanDocument([answered('a')], { stats: { requests: { total: 3 } } }),
      /declares 3 requests.*holds 1/,
    );
  });

  it('refuse a Newman report that declares more failed assertions than the items show', async () => {
    await rejects(
      newmanDocument([answered('a', [{}])], { stats: { assertions: { total: 1, failed: 2 } } }),
      /declares 2 failed assertions.*0/,
    );
  });

  it('refuse a Newman report that declares fewer assertions than it holds', async () => {
    await rejects(
      newmanDocument([answered('a', [{}, {}])], { stats: { assertions: { total: 1, failed: 0 } } }),
      /declares 1 assertions.*holds 2/,
    );
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
