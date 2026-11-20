import { differing, holds, isRecord, keysOf, missingFromGenerated, missingFromPinned, pointerTo, presenceDifference, } from './difference.js';
const EXEMPT_KEYWORDS = new Set(['description', 'summary', 'example', 'examples']);
const NAME_MAPS = new Set(['properties', 'patternProperties', 'definitions', '$defs']);
export function sameValue(first, second) {
    if (Array.isArray(first) && Array.isArray(second)) {
        return (first.length === second.length &&
            first.every((element) => second.some((other) => sameValue(element, other))) &&
            second.every((element) => first.some((other) => sameValue(element, other))));
    }
    if (isRecord(first) && isRecord(second)) {
        const keys = Object.keys(first);
        return (keys.length === Object.keys(second).length &&
            keys.every((key) => holds(second, key) && sameValue(first[key], second[key])));
    }
    return Object.is(first, second);
}
function elementDifferences(pair, pointer) {
    const lacking = (from, other) => from.flatMap((element, index) => (other.some((candidate) => sameValue(candidate, element)) ? [] : [index]));
    return [
        ...lacking(pair.pinned, pair.generated).map((index) => missingFromGenerated(pointerTo(pointer, index))),
        ...lacking(pair.generated, pair.pinned).map((index) => missingFromPinned(pointerTo(pointer, index))),
    ];
}
/** Compares two records member by member. In a map of names (such as `properties`) no key is a keyword to set aside. */
export function recordDifferences(pair, pointer, namesOnly = false) {
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
/** A deep comparison: records by member, arrays as sets, anything else by identity. Descriptions, summaries and examples are set aside. */
export function valueDifferences(pair, pointer, namesOnly = false) {
    const { pinned, generated } = pair;
    if (isRecord(pinned) && isRecord(generated)) {
        return recordDifferences({ pinned, generated }, pointer, namesOnly);
    }
    if (Array.isArray(pinned) && Array.isArray(generated)) {
        return elementDifferences({ pinned, generated }, pointer);
    }
    return sameValue(pinned, generated) ? [] : [differing(pointer)];
}
