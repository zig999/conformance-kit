import {
  differing,
  holds,
  keysOf,
  pointerTo,
  presenceDifference,
  recordOf,
  type IOasDifference,
  type IPair,
  type JsonRecord,
} from './difference.js';
import { parameterDifferences, type IParameterSide } from './parameters.js';
import { resolved } from './references.js';
import { recordDifferences, valueDifferences } from './values.js';

const HTTP_METHODS: readonly string[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

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

/** The headers a response carries (the link of a page, the total of a list) are part of the contract. */
function headersDifferences(bodies: IPair<JsonRecord>, pointer: string): IOasDifference[] {
  const at = pointerTo(pointer, 'headers');
  const absent = presenceDifference(bodies, 'headers', at);
  if (absent !== undefined) {
    return [absent];
  }
  const headers = { pinned: recordOf(bodies.pinned['headers']), generated: recordOf(bodies.generated['headers']) };
  return recordDifferences(headers, at, true);
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
    return [...headersDifferences(bodies, at), ...contentDifferences(bodies, at)];
  });
}

/** `required` that is absent is `required: false`. */
function requiredDifference(bodies: IPair<JsonRecord>, pointer: string): IOasDifference[] {
  const required = (body: JsonRecord): boolean => body['required'] === true;
  return required(bodies.pinned) === required(bodies.generated) ? [] : [differing(pointerTo(pointer, 'required'))];
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
  return holds(operations.pinned, 'requestBody')
    ? [...requiredDifference(bodies, at), ...contentDifferences(bodies, at)]
    : [];
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

const sideOf = (root: JsonRecord, pathItem: JsonRecord, operation: JsonRecord): IParameterSide => ({
  root,
  pathItem,
  operation,
});

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
    const sides = {
      pinned: sideOf(roots.pinned, items.pinned, operations.pinned),
      generated: sideOf(roots.generated, items.generated, operations.generated),
    };
    return [
      ...parameterDifferences(sides, { path: pointer, operation: at }),
      ...operationDifferences(roots, operations, at),
    ];
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
