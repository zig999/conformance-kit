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

const ESCAPED_TILDE = '~0';
const ESCAPED_SOLIDUS = '~1';

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function recordOf(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

export function pointerTo(parent: string, token: string | number): string {
  return `${parent}/${String(token).replaceAll('~', ESCAPED_TILDE).replaceAll('/', ESCAPED_SOLIDUS)}`;
}

export const missingFromGenerated = (pointer: string): IOasDifference => ({
  pointer,
  kind: 'absent-from-generated',
});

export const missingFromPinned = (pointer: string): IOasDifference => ({ pointer, kind: 'absent-from-pinned' });

export const differing = (pointer: string): IOasDifference => ({ pointer, kind: 'differs' });

export function holds(record: JsonRecord, key: string): boolean {
  return Object.hasOwn(record, key);
}

export function keysOf(pair: IPair<JsonRecord>): string[] {
  return [...new Set([...Object.keys(pair.pinned), ...Object.keys(pair.generated)])];
}

/** The difference of presence at a key, or nothing when both documents hold it or neither does. */
export function presenceDifference(pair: IPair<JsonRecord>, key: string, pointer: string): IOasDifference | undefined {
  const inPinned = holds(pair.pinned, key);
  const inGenerated = holds(pair.generated, key);
  if (inPinned === inGenerated) {
    return undefined;
  }
  return inPinned ? missingFromGenerated(pointer) : missingFromPinned(pointer);
}
