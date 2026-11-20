import { isRecord, pointerTo, recordOf, type JsonRecord } from './difference.js';

export const SCHEMAS_POINTER = '/components/schemas';

const MEMBER_KEYWORDS: ReadonlySet<string> = new Set(['properties', 'required', 'allOf']);

export interface IMemberView {
  readonly pointer: string;
  readonly required: boolean;
  /** The whole schema of the property, with every `$ref` read as the name of what it refers to. */
  readonly schema: JsonRecord;
}

export interface ISchemaView {
  readonly keywords: JsonRecord;
  readonly members: ReadonlyMap<string, IMemberView>;
}

interface IGathering {
  readonly schemas: JsonRecord;
  readonly members: Map<string, Omit<IMemberView, 'required'>>;
  readonly required: Set<string>;
  readonly visited: Set<string>;
}

const stringOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const arrayOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function referenceNameOf(node: unknown): string | undefined {
  return stringOf(recordOf(node)['$ref'])?.split('/').pop();
}

/** Reads `#/components/schemas/Product` and `Product` as the same reference, at any depth. */
function withReferencesByName(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withReferencesByName);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, member]) => [
      key,
      key === '$ref' && typeof member === 'string' ? (member.split('/').pop() ?? member) : withReferencesByName(member),
    ]),
  );
}

function gatherNode(gathering: IGathering, node: unknown, pointer: string): void {
  const schema = recordOf(node);
  const parent = referenceNameOf(schema);
  if (parent !== undefined) {
    gatherNamed(gathering, parent);
  }
  arrayOf(schema['allOf']).forEach((part, index) =>
    gatherNode(gathering, part, pointerTo(pointerTo(pointer, 'allOf'), index)),
  );
  const properties = pointerTo(pointer, 'properties');
  for (const [name, property] of Object.entries(recordOf(schema['properties']))) {
    gathering.members.set(name, {
      pointer: pointerTo(properties, name),
      schema: recordOf(withReferencesByName(property)),
    });
  }
  arrayOf(schema['required']).forEach((name) => typeof name === 'string' && gathering.required.add(name));
}

function gatherNamed(gathering: IGathering, name: string): void {
  if (gathering.visited.has(name)) {
    return;
  }
  gathering.visited.add(name);
  gatherNode(gathering, gathering.schemas[name], pointerTo(SCHEMAS_POINTER, name));
}

/** The keywords of a named schema, and its members as the schema holds them itself, through allOf and through the schema it refers to. */
export function schemaViewOf(schemas: JsonRecord, name: string): ISchemaView {
  const gathering: IGathering = { schemas, members: new Map(), required: new Set(), visited: new Set([name]) };
  gatherNode(gathering, schemas[name], pointerTo(SCHEMAS_POINTER, name));
  const keywords = Object.entries(recordOf(schemas[name])).filter(([key]) => !MEMBER_KEYWORDS.has(key));
  return {
    keywords: Object.fromEntries(keywords),
    members: new Map(
      [...gathering.members].map(([member, held]): [string, IMemberView] => [
        member,
        { ...held, required: gathering.required.has(member) },
      ]),
    ),
  };
}
