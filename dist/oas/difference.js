const ESCAPED_TILDE = '~0';
const ESCAPED_SOLIDUS = '~1';
export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function recordOf(value) {
    return isRecord(value) ? value : {};
}
export function pointerTo(parent, token) {
    return `${parent}/${String(token).replaceAll('~', ESCAPED_TILDE).replaceAll('/', ESCAPED_SOLIDUS)}`;
}
export const missingFromGenerated = (pointer) => ({
    pointer,
    kind: 'absent-from-generated',
});
export const missingFromPinned = (pointer) => ({ pointer, kind: 'absent-from-pinned' });
export const differing = (pointer) => ({ pointer, kind: 'differs' });
export function holds(record, key) {
    return Object.hasOwn(record, key);
}
export function keysOf(pair) {
    return [...new Set([...Object.keys(pair.pinned), ...Object.keys(pair.generated)])];
}
/** The difference of presence at a key, or nothing when both documents hold it or neither does. */
export function presenceDifference(pair, key, pointer) {
    const inPinned = holds(pair.pinned, key);
    const inGenerated = holds(pair.generated, key);
    if (inPinned === inGenerated) {
        return undefined;
    }
    return inPinned ? missingFromGenerated(pointer) : missingFromPinned(pointer);
}
