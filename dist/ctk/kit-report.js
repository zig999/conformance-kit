import { KitDidNotRunError } from '../shared/errors.js';
import { readDocument } from './kit-report-shapes.js';
const REPORT_DATA_SUFFIX = '.json';
function parseJson(text, path) {
    try {
        return JSON.parse(text);
    }
    catch (cause) {
        throw new KitDidNotRunError(`the kit report file ${path} does not hold JSON`, { path }, { cause });
    }
}
/**
 * Reads every .json file of the reports folder (CNF-15). No report, a report with no item, a failed hook, a file that
 * is neither Mocha nor Newman, or a report that does not add up to its own totals means the CTK did not run to the end.
 * (CNF-15 says hooks do not count; a failed one is the exception, because it stops the tests.)
 */
export async function readKitItems(files, reportsDirectory) {
    const paths = (await files.listFiles(reportsDirectory)).filter((path) => path.endsWith(REPORT_DATA_SUFFIX));
    if (paths.length === 0) {
        throw new KitDidNotRunError('the kit ended without writing a report', { reportsDirectory });
    }
    const documents = await Promise.all(paths.map(async (path) => parseJson(await files.readText(path), path)));
    const parsed = documents.map((document) => readDocument(document));
    parsed.forEach((document, position) => assertTrustworthy(document, paths[position] ?? ''));
    const failedHooks = [...new Set(parsed.flatMap((document) => document.failedHooks))];
    if (failedHooks.length > 0) {
        throw new KitDidNotRunError(`the kit report holds a failed hook, so the tests after it did not run: ${failedHooks.join('; ')}`, { reportsDirectory });
    }
    const items = parsed.flatMap((document) => document.items);
    if (items.length === 0) {
        throw new KitDidNotRunError('the kit report holds no result of any item', { reportsDirectory });
    }
    return items;
}
function assertTrustworthy(document, path) {
    if (document.kind === 'unknown') {
        throw new KitDidNotRunError(`the kit report file ${path} is neither a Mocha nor a Newman report`, { path });
    }
    if (document.problems.length > 0) {
        throw new KitDidNotRunError(`the kit report file ${path} cannot be trusted: ${document.problems.join('; ')}`, {
            path,
        });
    }
}
export function failedIdentifiers(items) {
    return [...new Set(items.filter((item) => !item.passed).map((item) => item.identifier))];
}
