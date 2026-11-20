export type OasDifferenceKind = 'absent-from-generated' | 'absent-from-pinned' | 'differs';
/** One difference between the pinned and the generated document, located by a JSON pointer of the OAS (CNF-02). */
export interface IOasDifference {
    readonly pointer: string;
    readonly kind: OasDifferenceKind;
}
export interface IPair<T> {
    readonly pinned: T;
    readonly generated: T;
}
export type JsonRecord = Readonly<Record<string, unknown>>;
export declare function isRecord(value: unknown): value is JsonRecord;
export declare function recordOf(value: unknown): JsonRecord;
export declare function pointerTo(parent: string, token: string | number): string;
export declare const missingFromGenerated: (pointer: string) => IOasDifference;
export declare const missingFromPinned: (pointer: string) => IOasDifference;
export declare const differing: (pointer: string) => IOasDifference;
export declare function holds(record: JsonRecord, key: string): boolean;
export declare function keysOf(pair: IPair<JsonRecord>): string[];
/** The difference of presence at a key, or nothing when both documents hold it or neither does. */
export declare function presenceDifference(pair: IPair<JsonRecord>, key: string, pointer: string): IOasDifference | undefined;
