import {
  differing,
  holds,
  isRecord,
  keysOf,
  pointerTo,
  presenceDifference,
  type IOasDifference,
  type IPair,
  type JsonRecord,
} from './difference.js';

const EXEMPT_KEYWORDS: ReadonlySet<string> = new Set(['description', 'summary', 'example', 'examples']);
const NAME_MAPS: ReadonlySet<string> = new Set(['properties', 'patternProperties', 'definitions', '$defs']);

export function sameValue(first: unknown, second: unknown): boolean {
  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((element) => second.some((other) => sameValue(element, other))) &&
      second.every((element) => first.some((other) => sameValue(element, other)))
    );
  }
  if (isRecord(first) && isRecord(second)) {
    const keys = Object.keys(first);
    return (
      keys.length === Object.keys(second).length &&
      keys.every((key) => holds(second, key) && sameValue(first[key], second[key]))
    );
  }
  return Object.is(first, second);
}

/** Compares two records member by member. In a map of names (such as `properties`) no key is a keyword to set aside. */
export function recordDifferences(pair: IPair<JsonRecord>, pointer: string, namesOnly = false): IOasDifference[] {
  return keysOf(pair)
    .filter((key) => namesOnly || !EXEMPT_KEYWORDS.has(key))
    .flatMap((key) => {
      const target = pointerTo(pointer, key);
      const absent = presenceDifference(pair, key, target);
      if (absent !== undefined) {
        return [absent];
      }
      const child = { pinned: pair.pinned[key], generated: pair.generated[key] };
      return valueDifferences(child, target, NAME_MAPS.has(key));
    });
}

/**
 * A deep comparison: records by member, anything else by identity. Descriptions, summaries and examples are set aside.
 * A list is read as a set and, where the two differ, is one difference at the pointer of the list itself.
 */
export function valueDifferences(pair: IPair<unknown>, pointer: string, namesOnly = false): IOasDifference[] {
  const { pinned, generated } = pair;
  if (isRecord(pinned) && isRecord(generated)) {
    return recordDifferences({ pinned, generated }, pointer, namesOnly);
  }
  return sameValue(pinned, generated) ? [] : [differing(pointer)];
}
