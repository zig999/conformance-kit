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
import { SCHEMAS_POINTER, schemaViewOf, type IMemberView, type ISchemaView } from './schema-view.js';
import { recordDifferences } from './values.js';

/**
 * A member required in one document and not in the other, at the pointer of the `required` list that names it:
 * a change to that list where the other document holds a list there, and the list itself absent where it does not.
 */
function requirementDifference(member: IPair<IMemberView>, views: IPair<ISchemaView>): IOasDifference[] {
  const { pinned, generated } = member;
  if (pinned.requiredAt !== undefined && generated.requiredAt === undefined) {
    const list = pinned.requiredAt;
    return [views.generated.requiredLists.has(list) ? differing(list) : missingFromGenerated(list)];
  }
  if (generated.requiredAt !== undefined && pinned.requiredAt === undefined) {
    const list = generated.requiredAt;
    return [views.pinned.requiredLists.has(list) ? differing(list) : missingFromPinned(list)];
  }
  return [];
}

/** Everything a property says (type, format, constraints, items, inline properties, compositions) except prose. */
function memberDifferences(member: IPair<IMemberView>, views: IPair<ISchemaView>): IOasDifference[] {
  const pointer = member.pinned.pointer;
  return [
    ...recordDifferences({ pinned: member.pinned.schema, generated: member.generated.schema }, pointer),
    ...requirementDifference(member, views),
  ];
}

function membersDifferences(views: IPair<ISchemaView>): IOasDifference[] {
  const members = { pinned: views.pinned.members, generated: views.generated.members };
  const names = new Set([...members.pinned.keys(), ...members.generated.keys()]);
  return [...names].flatMap((name) => {
    const pinned = members.pinned.get(name);
    const generated = members.generated.get(name);
    if (pinned !== undefined && generated !== undefined) {
      return memberDifferences({ pinned, generated }, views);
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
    ...membersDifferences({ pinned, generated }),
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
