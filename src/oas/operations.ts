import {
  holds,
  keysOf,
  pointerTo,
  presenceDifference,
  recordOf,
  type IOasDifference,
  type IPair,
  type JsonRecord,
} from './difference.js';
import { valueDifferences } from './values.js';

const HTTP_METHODS: readonly string[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const COMPONENT_REFERENCE = /^#\/components\/([A-Za-z]+)\/(.+)$/;
const REFERENCE_SECTION_GROUP = 1;
const REFERENCE_NAME_GROUP = 2;

/** A response or a request body may be given by reference; both sides are read as the thing they refer to. */
function resolved(root: JsonRecord, node: unknown, section: string): JsonRecord {
  const target = recordOf(node);
  const reference = target['$ref'];
  const match = typeof reference === 'string' ? COMPONENT_REFERENCE.exec(reference) : null;
  if (match?.[REFERENCE_SECTION_GROUP] !== section) {
    return target;
  }
  return recordOf(recordOf(recordOf(root['components'])[section])[match[REFERENCE_NAME_GROUP] ?? '']);
}

function contentDifferences(bodies: IPair<JsonRecord>, pointer: string): IOasDifference[] {
  const contents = { pinned: recordOf(bodies.pinned['content']), generated: recordOf(bodies.generated['content']) };
  const target = pointerTo(pointer, 'content');
  return keysOf(contents).flatMap((mediaType) => {
    const at = pointerTo(target, mediaType);
    const absent = presenceDifference(contents, mediaType, at);
    if (absent !== undefined) {
      return [absent];
    }
    const schemas = {
      pinned: recordOf(contents.pinned[mediaType])['schema'],
      generated: recordOf(contents.generated[mediaType])['schema'],
    };
    return valueDifferences(schemas, pointerTo(at, 'schema'));
  });
}

function responseDifferences(roots: IPair<JsonRecord>, codes: IPair<JsonRecord>, pointer: string): IOasDifference[] {
  return keysOf(codes).flatMap((code) => {
    const at = pointerTo(pointer, code);
    const absent = presenceDifference(codes, code, at);
    if (absent !== undefined) {
      return [absent];
    }
    const bodies = {
      pinned: resolved(roots.pinned, codes.pinned[code], 'responses'),
      generated: resolved(roots.generated, codes.generated[code], 'responses'),
    };
    return contentDifferences(bodies, at);
  });
}

function requestBodyDifferences(
  roots: IPair<JsonRecord>,
  operations: IPair<JsonRecord>,
  pointer: string,
): IOasDifference[] {
  const at = pointerTo(pointer, 'requestBody');
  const absent = presenceDifference(operations, 'requestBody', at);
  if (absent !== undefined) {
    return [absent];
  }
  const bodies = {
    pinned: resolved(roots.pinned, operations.pinned['requestBody'], 'requestBodies'),
    generated: resolved(roots.generated, operations.generated['requestBody'], 'requestBodies'),
  };
  return holds(operations.pinned, 'requestBody') ? contentDifferences(bodies, at) : [];
}

function operationDifferences(
  roots: IPair<JsonRecord>,
  operations: IPair<JsonRecord>,
  pointer: string,
): IOasDifference[] {
  const codes = {
    pinned: recordOf(operations.pinned['responses']),
    generated: recordOf(operations.generated['responses']),
  };
  return [
    ...requestBodyDifferences(roots, operations, pointer),
    ...responseDifferences(roots, codes, pointerTo(pointer, 'responses')),
  ];
}

function methodDifferences(roots: IPair<JsonRecord>, items: IPair<JsonRecord>, pointer: string): IOasDifference[] {
  return HTTP_METHODS.flatMap((method) => {
    const at = pointerTo(pointer, method);
    const absent = presenceDifference(items, method, at);
    if (absent !== undefined) {
      return [absent];
    }
    if (!holds(items.pinned, method)) {
      return [];
    }
    const operations = { pinned: recordOf(items.pinned[method]), generated: recordOf(items.generated[method]) };
    return operationDifferences(roots, operations, at);
  });
}

/** Paths, operations, request bodies and response codes, with the schema each one carries (CNF-02). */
export function pathDifferences(roots: IPair<JsonRecord>): IOasDifference[] {
  const paths = { pinned: recordOf(roots.pinned['paths']), generated: recordOf(roots.generated['paths']) };
  return keysOf(paths).flatMap((path) => {
    const at = pointerTo('/paths', path);
    const absent = presenceDifference(paths, path, at);
    if (absent !== undefined) {
      return [absent];
    }
    const items = { pinned: recordOf(paths.pinned[path]), generated: recordOf(paths.generated[path]) };
    return methodDifferences(roots, items, at);
  });
}
