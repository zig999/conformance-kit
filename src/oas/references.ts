import { recordOf, type JsonRecord } from './difference.js';

const COMPONENT_REFERENCE = /^#\/components\/([A-Za-z]+)\/(.+)$/;
const REFERENCE_SECTION_GROUP = 1;
const REFERENCE_NAME_GROUP = 2;

/** A response, a request body or a parameter may be given by reference; both sides are read as the thing they refer to. */
export function resolved(root: JsonRecord, node: unknown, section: string): JsonRecord {
  const target = recordOf(node);
  const reference = target['$ref'];
  const match = typeof reference === 'string' ? COMPONENT_REFERENCE.exec(reference) : null;
  if (match?.[REFERENCE_SECTION_GROUP] !== section) {
    return target;
  }
  return recordOf(recordOf(recordOf(root['components'])[section])[match[REFERENCE_NAME_GROUP] ?? '']);
}
