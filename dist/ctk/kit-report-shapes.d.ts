export interface IKitItem {
    readonly identifier: string;
    readonly passed: boolean;
}
/** Reads the items of one parsed CTK report, Mocha or Newman. A document of another shape holds no item. */
export declare function itemsOfDocument(document: unknown): IKitItem[];
