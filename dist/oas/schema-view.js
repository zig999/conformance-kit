import { isRecord, pointerTo, recordOf } from './difference.js';
export const SCHEMAS_POINTER = '/components/schemas';
const MEMBER_KEYWORDS = new Set(['properties', 'required', 'allOf']);
const stringOf = (value) => (typeof value === 'string' ? value : undefined);
const arrayOf = (value) => (Array.isArray(value) ? value : []);
function referenceNameOf(node) {
    return stringOf(recordOf(node)['$ref'])?.split('/').pop();
}
/** Reads `#/components/schemas/Product` and `Product` as the same reference, at any depth. */
function withReferencesByName(value) {
    if (Array.isArray(value)) {
        return value.map(withReferencesByName);
    }
    if (!isRecord(value)) {
        return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, member]) => [
        key,
        key === '$ref' && typeof member === 'string' ? (member.split('/').pop() ?? member) : withReferencesByName(member),
    ]));
}
function gatherNode(gathering, node, pointer) {
    const schema = recordOf(node);
    const parent = referenceNameOf(schema);
    if (parent !== undefined) {
        gatherNamed(gathering, parent);
    }
    arrayOf(schema['allOf']).forEach((part, index) => gatherNode(gathering, part, pointerTo(pointerTo(pointer, 'allOf'), index)));
    const properties = pointerTo(pointer, 'properties');
    for (const [name, property] of Object.entries(recordOf(schema['properties']))) {
        gathering.members.set(name, {
            pointer: pointerTo(properties, name),
            schema: recordOf(withReferencesByName(property)),
        });
    }
    gatherRequired(gathering, schema, pointer);
}
function gatherRequired(gathering, schema, pointer) {
    if (!Array.isArray(schema['required'])) {
        return;
    }
    const list = pointerTo(pointer, 'required');
    gathering.requiredLists.add(list);
    for (const name of arrayOf(schema['required'])) {
        if (typeof name === 'string' && !gathering.required.has(name)) {
            gathering.required.set(name, list);
        }
    }
}
function gatherNamed(gathering, name) {
    if (gathering.visited.has(name)) {
        return;
    }
    gathering.visited.add(name);
    gatherNode(gathering, gathering.schemas[name], pointerTo(SCHEMAS_POINTER, name));
}
/** The keywords of a named schema, and its members as the schema holds them itself, through allOf and through the schema it refers to. */
export function schemaViewOf(schemas, name) {
    const gathering = {
        schemas,
        members: new Map(),
        required: new Map(),
        requiredLists: new Set(),
        visited: new Set([name]),
    };
    gatherNode(gathering, schemas[name], pointerTo(SCHEMAS_POINTER, name));
    const keywords = Object.entries(recordOf(schemas[name])).filter(([key]) => !MEMBER_KEYWORDS.has(key));
    return {
        keywords: Object.fromEntries(keywords),
        members: new Map([...gathering.members].map(([member, held]) => [
            member,
            { ...held, requiredAt: gathering.required.get(member) },
        ])),
        requiredLists: gathering.requiredLists,
    };
}
