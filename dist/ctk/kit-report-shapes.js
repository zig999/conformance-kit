import { z } from 'zod';
import { normalizeIdentifier } from '../shared/identifier.js';
const PASSED_STATE = 'passed';
const MochaTestSchema = z.object({
    title: z.string(),
    fullTitle: z.string().optional(),
    state: z.string().optional(),
    fail: z.boolean().optional(),
    pending: z.boolean().optional(),
    skipped: z.boolean().optional(),
    isHook: z.boolean().optional(),
});
const MochaSuiteSchema = z.object({
    tests: z.array(MochaTestSchema).optional(),
    get suites() {
        return z.array(MochaSuiteSchema).optional();
    },
});
const MochaReportSchema = z.object({ results: z.array(MochaSuiteSchema) });
const NewmanAssertionSchema = z.object({
    skipped: z.boolean().optional(),
    error: z.unknown().optional(),
});
const NewmanExecutionSchema = z.object({
    item: z.object({ name: z.string() }),
    response: z.unknown().optional(),
    requestError: z.unknown().optional(),
    assertions: z.array(NewmanAssertionSchema).optional(),
});
const NewmanReportSchema = z.object({ run: z.object({ executions: z.array(NewmanExecutionSchema) }) });
function isPresent(value) {
    return value !== undefined && value !== null;
}
function mochaItemOf(test) {
    const ran = test.state === PASSED_STATE;
    const unmarked = test.fail !== true && test.pending !== true && test.skipped !== true;
    return { identifier: normalizeIdentifier(test.fullTitle ?? test.title), passed: ran && unmarked };
}
function mochaItemsOf(suite) {
    const own = (suite.tests ?? []).filter((test) => test.isHook !== true).map(mochaItemOf);
    return [...own, ...(suite.suites ?? []).flatMap(mochaItemsOf)];
}
function newmanItemOf(execution) {
    const answered = isPresent(execution.response) && !isPresent(execution.requestError);
    const assertionsPassed = (execution.assertions ?? []).every((assertion) => assertion.skipped !== true && !isPresent(assertion.error));
    return { identifier: normalizeIdentifier(execution.item.name), passed: answered && assertionsPassed };
}
/** Reads the items of one parsed CTK report, Mocha or Newman. A document of another shape holds no item. */
export function itemsOfDocument(document) {
    const mocha = MochaReportSchema.safeParse(document);
    if (mocha.success) {
        return mocha.data.results.flatMap(mochaItemsOf);
    }
    const newman = NewmanReportSchema.safeParse(document);
    return newman.success ? newman.data.run.executions.map(newmanItemOf) : [];
}
