import { keysOf, missingFromGenerated, missingFromPinned, pointerTo, } from './difference.js';
import { resolved } from './references.js';
import { valueDifferences } from './values.js';
function declaredIn(root, parameters, pointer) {
    const list = Array.isArray(parameters) ? parameters : [];
    return list.map((parameter, index) => {
        const value = resolved(root, parameter, 'parameters');
        const key = typeof value['name'] === 'string' && typeof value['in'] === 'string'
            ? `${value['in']}:${value['name']}`
            : `?:${String(index)}`;
        return [key, { value, pointer: pointerTo(pointer, index) }];
    });
}
/** A parameter is told apart by its place and its name. The ones of the path apply to every operation, which may override them. */
function effective(side, pointers) {
    return new Map([
        ...declaredIn(side.root, side.pathItem['parameters'], pointerTo(pointers.path, 'parameters')),
        ...declaredIn(side.root, side.operation['parameters'], pointerTo(pointers.operation, 'parameters')),
    ]);
}
/** The query filters, the paging and the selection of an operation are part of its contract (CNF-02, CNF-03). */
export function parameterDifferences(sides, pointers) {
    const parameters = { pinned: effective(sides.pinned, pointers), generated: effective(sides.generated, pointers) };
    const keys = keysOf({
        pinned: Object.fromEntries(parameters.pinned),
        generated: Object.fromEntries(parameters.generated),
    });
    return keys.flatMap((key) => {
        const pinned = parameters.pinned.get(key);
        const generated = parameters.generated.get(key);
        if (pinned !== undefined && generated !== undefined) {
            return valueDifferences({ pinned: pinned.value, generated: generated.value }, pinned.pointer);
        }
        return pinned === undefined
            ? [missingFromPinned(generated?.pointer ?? '')]
            : [missingFromGenerated(pinned.pointer)];
    });
}
