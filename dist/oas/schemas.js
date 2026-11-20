import { differing, keysOf, missingFromGenerated, missingFromPinned, pointerTo, presenceDifference, recordOf, } from './difference.js';
import { SCHEMAS_POINTER, schemaViewOf } from './schema-view.js';
import { recordDifferences } from './values.js';
/** Everything a property says (type, format, constraints, items, inline properties, compositions) except prose. */
function memberDifferences(member) {
    const pointer = member.pinned.pointer;
    const found = recordDifferences({ pinned: member.pinned.schema, generated: member.generated.schema }, pointer);
    return member.pinned.required === member.generated.required ? found : [...found, differing(pointer)];
}
function membersDifferences(members) {
    const names = new Set([...members.pinned.keys(), ...members.generated.keys()]);
    return [...names].flatMap((name) => {
        const pinned = members.pinned.get(name);
        const generated = members.generated.get(name);
        if (pinned !== undefined && generated !== undefined) {
            return memberDifferences({ pinned, generated });
        }
        if (pinned !== undefined) {
            return [missingFromGenerated(pinned.pointer)];
        }
        return generated === undefined ? [] : [missingFromPinned(generated.pointer)];
    });
}
function schemaDifferences(schemas, name) {
    const pinned = schemaViewOf(schemas.pinned, name);
    const generated = schemaViewOf(schemas.generated, name);
    return [
        ...recordDifferences({ pinned: pinned.keywords, generated: generated.keywords }, pointerTo(SCHEMAS_POINTER, name)),
        ...membersDifferences({ pinned: pinned.members, generated: generated.members }),
    ];
}
/** Named schemas: presence, keywords (states included) and members, flattened through allOf (CNF-02). */
export function schemaSetDifferences(roots) {
    const schemas = {
        pinned: recordOf(recordOf(roots.pinned['components'])['schemas']),
        generated: recordOf(recordOf(roots.generated['components'])['schemas']),
    };
    return keysOf(schemas).flatMap((name) => {
        const absent = presenceDifference(schemas, name, pointerTo(SCHEMAS_POINTER, name));
        return absent === undefined ? schemaDifferences(schemas, name) : [absent];
    });
}
