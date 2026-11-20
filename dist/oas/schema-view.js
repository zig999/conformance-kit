import { pointerTo, recordOf } from './difference.js';
export const SCHEMAS_POINTER = '/components/schemas';
const MEMBER_KEYWORDS = new Set(['properties', 'required', 'allOf']);
const stringOf = (value) => (typeof value === 'string' ? value : undefined);
const arrayOf = (value) => (Array.isArray(value) ? value : []);
function referenceNameOf(node) {
    return stringOf(recordOf(node)['$ref'])?.split('/').pop();
}
function itemsFacetOf(items) {
    const schema = recordOf(items);
    const type = stringOf(schema['type']);
    const format = stringOf(schema['format']);
    const formatted = type === undefined || format === undefined ? type : `${type}(${format})`;
    return referenceNameOf(schema) ?? formatted;
}
function statesOf(schema) {
    const states = schema['enum'];
    return Array.isArray(states) ? JSON.stringify(states.map((state) => JSON.stringify(state)).toSorted()) : undefined;
}
function facetsOf(property) {
    const schema = recordOf(property);
    return {
        type: stringOf(schema['type']),
        format: stringOf(schema['format']),
        reference: referenceNameOf(schema),
        items: itemsFacetOf(schema['items']),
        states: statesOf(schema),
    };
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
        gathering.members.set(name, { pointer: pointerTo(properties, name), ...facetsOf(property) });
    }
    arrayOf(schema['required']).forEach((name) => typeof name === 'string' && gathering.required.add(name));
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
    const gathering = { schemas, members: new Map(), required: new Set(), visited: new Set([name]) };
    gatherNode(gathering, schemas[name], pointerTo(SCHEMAS_POINTER, name));
    const keywords = Object.entries(recordOf(schemas[name])).filter(([key]) => !MEMBER_KEYWORDS.has(key));
    return {
        keywords: Object.fromEntries(keywords),
        members: new Map([...gathering.members].map(([member, held]) => [
            member,
            { ...held, required: gathering.required.has(member) },
        ])),
    };
}
