export interface IStatementNames {
    readonly pointers: readonly string[];
    readonly items: readonly string[];
}
/** JSON pointers are the double-quoted JSON strings; CTK item identifiers are the texts between grave accents (CNF-06). */
export declare function namesOf(statement: string, node: string): IStatementNames;
