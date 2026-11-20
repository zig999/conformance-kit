import {
  differing,
  keysOf,
  missingFromGenerated,
  missingFromPinned,
  pointerTo,
  presenceDifference,
  recordOf,
  type IOasDifference,
  type IPair,
  type JsonRecord,
} from './difference.js';
import { SCHEMAS_POINTER, schemaViewOf, type IMemberFacets, type IMemberView } from './schema-view.js';
import { recordDifferences } from './values.js';

const FACETS: readonly (keyof IMemberFacets)[] = ['type', 'format', 'reference', 'items', 'states'];
const FACET_KEYWORDS: Readonly<Record<keyof IMemberFacets, string>> = {
  type: 'type',
  format: 'format',
  reference: '$ref',
  items: 'items',
  states: 'enum',
};

function memberDifferences(member: IPair<IMemberView>): IOasDifference[] {
  const pointer = member.pinned.pointer;
  const facets = FACETS.filter((facet) => member.pinned[facet] !== member.generated[facet]);
  const found = facets.map((facet) => differing(pointerTo(pointer, FACET_KEYWORDS[facet])));
  return member.pinned.required === member.generated.required ? found : [...found, differing(pointer)];
}

function membersDifferences(members: IPair<ReadonlyMap<string, IMemberView>>): IOasDifference[] {
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

function schemaDifferences(schemas: IPair<JsonRecord>, name: string): IOasDifference[] {
  const pinned = schemaViewOf(schemas.pinned, name);
  const generated = schemaViewOf(schemas.generated, name);
  return [
    ...recordDifferences({ pinned: pinned.keywords, generated: generated.keywords }, pointerTo(SCHEMAS_POINTER, name)),
    ...membersDifferences({ pinned: pinned.members, generated: generated.members }),
  ];
}

/** Named schemas: presence, keywords (states included) and members, flattened through allOf (CNF-02). */
export function schemaSetDifferences(roots: IPair<JsonRecord>): IOasDifference[] {
  const schemas = {
    pinned: recordOf(recordOf(roots.pinned['components'])['schemas']),
    generated: recordOf(recordOf(roots.generated['components'])['schemas']),
  };
  return keysOf(schemas).flatMap((name) => {
    const absent = presenceDifference(schemas, name, pointerTo(SCHEMAS_POINTER, name));
    return absent === undefined ? schemaDifferences(schemas, name) : [absent];
  });
}
