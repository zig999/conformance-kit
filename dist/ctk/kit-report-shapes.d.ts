export interface IKitItem {
    readonly identifier: string;
    readonly passed: boolean;
}
/**
 * What one CTK report holds: its items, the hooks that failed (the tests after them never ran), and what the report
 * says that does not agree with itself. A document that is neither a Mocha nor a Newman report is `unknown`.
 */
export interface IKitDocument {
    readonly kind: 'mocha' | 'newman' | 'unknown';
    readonly items: IKitItem[];
    readonly failedHooks: string[];
    readonly problems: string[];
}
/**
 * Reads one parsed CTK report, Mocha or Newman, and checks it against the totals it declares: a report whose items
 * do not add up to its own `stats` is one the kit cannot trust, whatever the cause, and a hook that failed is one
 * whose later tests never ran. A failure that Newman lists in `run.failures` is a failed item. A document of another
 * shape is `unknown`.
 */
export declare function readDocument(document: unknown): IKitDocument;
