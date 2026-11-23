import { describe, expect, it } from 'vitest';
import { compareOas } from '../../src/oas/compare.js';
import { baseDocument, copyOf, withMember, without } from '../support/oas-documents.js';

const pinned = baseDocument();
const pointersOfPair = (pinned: unknown, generated: unknown): string[] =>
  compareOas(pinned, generated).map((difference) => difference.pointer);
const pointersOf = (generated: unknown, kind?: string): string[] =>
  compareOas(pinned, generated)
    .filter((difference) => kind === undefined || difference.kind === kind)
    .map((difference) => difference.pointer);

describe('comparing the published document with the pinned one', () => {
  it('finds nothing in two equal documents', () => {
    expect(compareOas(pinned, copyOf(pinned))).toEqual([]);
  });

  it('ignores the metadata of the document, descriptions, summaries and examples', () => {
    let generated = withMember(copyOf(pinned), [], 'openapi', '3.0.3');
    generated = withMember(generated, [], 'info', { title: 'Generated', version: '0' });
    generated = withMember(generated, [], 'servers', []);
    generated = withMember(generated, ['paths', '/product', 'get'], 'summary', 'Another summary');
    generated = withMember(generated, ['components', 'schemas', 'Product'], 'description', 'Another');
    generated = withMember(generated, ['components', 'schemas', 'Product'], 'example', { id: '1' });
    expect(compareOas(pinned, generated)).toEqual([]);
  });

  it('finds a path that the generated document lacks, with the pointer escaped', () => {
    const generated = without(pinned, ['paths'], '/product/{id}');
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/paths/~1product~1{id}', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a path that the pinned document lacks', () => {
    const generated = withMember(copyOf(pinned), ['paths'], '/extra', { get: { responses: {} } });
    expect(compareOas(pinned, generated)).toEqual([{ pointer: '/paths/~1extra', kind: 'absent-from-pinned' }]);
  });

  it('finds an operation that the generated document lacks', () => {
    const generated = without(pinned, ['paths', '/product'], 'post');
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/paths/~1product/post', kind: 'absent-from-generated' },
    ]);
  });

  it('finds an operation that the pinned document lacks', () => {
    const generated = withMember(copyOf(pinned), ['paths', '/product'], 'delete', { responses: {} });
    expect(pointersOf(generated, 'absent-from-pinned')).toEqual(['/paths/~1product/delete']);
  });

  it('finds a response code that the generated document lacks', () => {
    const generated = without(pinned, ['paths', '/product', 'get', 'responses'], '200');
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/paths/~1product/get/responses/200', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a response code that the pinned document lacks', () => {
    const generated = withMember(copyOf(pinned), ['paths', '/product', 'get', 'responses'], '202', { description: '' });
    expect(pointersOf(generated, 'absent-from-pinned')).toEqual(['/paths/~1product/get/responses/202']);
  });

  it('finds a response whose schema differs, down to the member', () => {
    const generated = withMember(
      copyOf(pinned),
      ['paths', '/product', 'get', 'responses', '200', 'content', 'application/json', 'schema', 'items'],
      '$ref',
      '#/components/schemas/Error',
    );
    expect(pointersOf(generated)).toEqual([
      '/paths/~1product/get/responses/200/content/application~1json/schema/items/$ref',
    ]);
  });

  it('finds a response whose media type the generated document lacks', () => {
    const generated = without(pinned, ['paths', '/product', 'get', 'responses', '200'], 'content');
    expect(pointersOf(generated)).toEqual(['/paths/~1product/get/responses/200/content/application~1json']);
  });

  it('reads a response given by reference and the same response written inline as equal', () => {
    const inline = withMember(copyOf(pinned), ['paths', '/product', 'get', 'responses'], '404', {
      description: 'not found',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    });
    expect(compareOas(pinned, inline)).toEqual([]);
  });

  it('finds a request body that the generated document lacks', () => {
    const generated = without(pinned, ['paths', '/product', 'post'], 'requestBody');
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/paths/~1product/post/requestBody', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a request body whose schema differs', () => {
    const generated = withMember(
      copyOf(pinned),
      ['paths', '/product', 'post', 'requestBody', 'content', 'application/json', 'schema'],
      '$ref',
      '#/components/schemas/Product',
    );
    expect(pointersOf(generated)).toEqual(['/paths/~1product/post/requestBody/content/application~1json/schema/$ref']);
  });
});

describe('comparing the schemas', () => {
  it('finds a schema that the generated document lacks, and one that the pinned lacks', () => {
    const lacking = without(pinned, ['components', 'schemas'], 'Error');
    expect(pointersOf(lacking, 'absent-from-generated')).toContain('/components/schemas/Error');
    const extra = withMember(copyOf(pinned), ['components', 'schemas'], 'Extra', { type: 'object' });
    expect(pointersOf(extra, 'absent-from-pinned')).toEqual(['/components/schemas/Extra']);
  });

  it('finds a state that the generated document lacks as one difference at the list of states', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'ProductStatusType'], 'enum', ['created']);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/ProductStatusType/enum', kind: 'differs' },
    ]);
  });

  it('finds a state that the pinned document lacks as one difference at the list of states', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'ProductStatusType'], 'enum', [
      'created',
      'active',
      'cancelled',
    ]);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/ProductStatusType/enum', kind: 'differs' },
    ]);
  });

  it('reads the states as a set, whatever their order', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'ProductStatusType'], 'enum', [
      'active',
      'created',
    ]);
    expect(compareOas(pinned, generated)).toEqual([]);
  });

  it('finds a keyword of the schema that differs', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'ProductStatusType'], 'type', 'integer');
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/ProductStatusType/type', kind: 'differs' },
    ]);
  });

  it('finds a member that the generated document lacks', () => {
    const generated = without(pinned, ['components', 'schemas', 'Product', 'properties'], 'id');
    expect(pointersOf(generated, 'absent-from-generated')).toEqual(['/components/schemas/Product/properties/id']);
  });

  it('finds a member whose type differs', () => {
    const generated = withMember(
      copyOf(pinned),
      ['components', 'schemas', 'Product', 'properties', 'id'],
      'type',
      'integer',
    );
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Product/properties/id/type', kind: 'differs' },
    ]);
  });

  it('finds a member whose format, reference or items differ', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'Product', 'properties'], 'status', {
      $ref: '#/components/schemas/Error',
    });
    expect(pointersOf(generated)).toEqual(['/components/schemas/Product/properties/status/$ref']);
  });

  it('finds a member that is required in one document and not in the other at the list that names it', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'Product'], 'required', []);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Product/required', kind: 'differs' },
    ]);
  });

  it('finds a list of required members that the generated document lacks', () => {
    const generated = without(pinned, ['components', 'schemas', 'Product'], 'required');
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Product/required', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a list of required members that the pinned document lacks', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'Error'], 'required', ['code']);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Error/required', kind: 'absent-from-pinned' },
    ]);
  });

  it('finds a changed list of required members inside allOf once, at the pointer of that list', () => {
    const part = { properties: { name: { type: 'string' }, code: { type: 'string' } }, required: ['name', 'code'] };
    const withPart = (document: unknown, value: unknown): unknown =>
      withMember(copyOf(document as Record<string, unknown>), ['components', 'schemas', 'ProductCreate'], 'allOf', [
        { $ref: '#/components/schemas/Product' },
        value,
      ]);
    const pinnedPart = withPart(pinned, part);
    const generated = withPart(pinned, { ...part, required: [] });
    expect(compareOas(pinnedPart, generated)).toEqual([
      { pointer: '/components/schemas/ProductCreate/allOf/1/required', kind: 'differs' },
    ]);
  });

  it('reads the members of a schema through allOf and through the schema it refers to', () => {
    const flattened = withMember(copyOf(pinned), ['components', 'schemas'], 'ProductCreate', {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { $ref: '#/components/schemas/ProductStatusType' },
        name: { type: 'string' },
      },
      required: ['id'],
    });
    expect(compareOas(pinned, flattened)).toEqual([]);
  });
});

describe('comparing everything a property carries, not only its type', () => {
  const ID = ['components', 'schemas', 'Product', 'properties', 'id'];
  const pinnedWith = (path: string[], key: string, value: unknown) =>
    withMember(copyOf(baseDocument()), path, key, value);

  it('finds a constraint that the generated property lacks', () => {
    const pinned = pinnedWith(ID, 'maxLength', 255);
    expect(compareOas(pinned, baseDocument())).toEqual([
      { pointer: '/components/schemas/Product/properties/id/maxLength', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a constraint that the pinned property lacks', () => {
    const generated = withMember(copyOf(baseDocument()), ID, 'nullable', true);
    expect(compareOas(baseDocument(), generated)).toEqual([
      { pointer: '/components/schemas/Product/properties/id/nullable', kind: 'absent-from-pinned' },
    ]);
  });

  it('finds a constraint whose value differs', () => {
    const pinned = pinnedWith(ID, 'maxLength', 255);
    const generated = withMember(copyOf(baseDocument()), ID, 'maxLength', 100);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Product/properties/id/maxLength', kind: 'differs' },
    ]);
  });

  it.each([
    ['readOnly', true],
    ['writeOnly', true],
    ['pattern', '^[a-z]+$'],
    ['minLength', 1],
    ['minimum', 0],
    ['maximum', 10],
    ['exclusiveMinimum', true],
    ['multipleOf', 5],
    ['minItems', 1],
    ['maxItems', 9],
    ['uniqueItems', true],
    ['default', 'x'],
    ['additionalProperties', false],
  ])('finds %s missing from the generated property', (keyword, value) => {
    const pinned = pinnedWith(ID, keyword, value);
    expect(pointersOfPair(pinned, baseDocument())).toEqual([`/components/schemas/Product/properties/id/${keyword}`]);
  });

  it('finds a constraint inside the items of an array property', () => {
    const items = { type: 'string', maxLength: 5 };
    const pinned = pinnedWith(['components', 'schemas', 'Product', 'properties'], 'tags', { type: 'array', items });
    const generated = withMember(
      copyOf(pinned),
      ['components', 'schemas', 'Product', 'properties', 'tags', 'items'],
      'maxLength',
      6,
    );
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Product/properties/tags/items/maxLength', kind: 'differs' },
    ]);
  });

  it('finds a difference inside an object property written inline', () => {
    const meta = { type: 'object', properties: { key: { type: 'string' } } };
    const pinned = pinnedWith(['components', 'schemas', 'Product', 'properties'], 'meta', meta);
    const generated = withMember(
      copyOf(pinned),
      ['components', 'schemas', 'Product', 'properties', 'meta', 'properties', 'key'],
      'type',
      'integer',
    );
    expect(pointersOfPair(pinned, generated)).toEqual([
      '/components/schemas/Product/properties/meta/properties/key/type',
    ]);
  });

  it('compares an inline property called description, which is a name and not prose', () => {
    const meta = { type: 'object', properties: { description: { type: 'string' } } };
    const pinned = pinnedWith(['components', 'schemas', 'Product', 'properties'], 'meta', meta);
    const generated = withMember(
      copyOf(pinned),
      ['components', 'schemas', 'Product', 'properties', 'meta', 'properties', 'description'],
      'type',
      'integer',
    );
    expect(pointersOfPair(pinned, generated)).toEqual([
      '/components/schemas/Product/properties/meta/properties/description/type',
    ]);
  });

  it('finds a property written with oneOf whose alternatives differ', () => {
    const choice = { oneOf: [{ type: 'string' }, { type: 'integer' }] };
    const pinned = pinnedWith(['components', 'schemas', 'Product', 'properties'], 'choice', choice);
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'Product', 'properties'], 'choice', {
      oneOf: [{ type: 'string' }, { type: 'boolean' }],
    });
    expect(pointersOfPair(pinned, generated)).toEqual(['/components/schemas/Product/properties/choice/oneOf']);
  });

  it('still sets the prose of a property aside, at any depth', () => {
    const generated = withMember(copyOf(baseDocument()), ID, 'description', 'Another');
    const withExample = withMember(generated, ID, 'example', 'x');
    expect(compareOas(baseDocument(), withExample)).toEqual([]);
  });
});

describe('comparing the parameters of an operation', () => {
  const GET = ['paths', '/product', 'get'];
  const limit = (overrides: Record<string, unknown> = {}) => ({
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', maximum: 100 },
    ...overrides,
  });
  const withParameters = (parameters: unknown[]) => withMember(copyOf(baseDocument()), GET, 'parameters', parameters);

  it('finds nothing in two operations with the same parameters, whatever their order', () => {
    const offset = { name: 'offset', in: 'query', schema: { type: 'integer' } };
    expect(compareOas(withParameters([limit(), offset]), withParameters([offset, limit()]))).toEqual([]);
  });

  it('finds a parameter that the generated operation lacks, by where the pinned one is declared', () => {
    expect(compareOas(withParameters([limit()]), baseDocument())).toEqual([
      { pointer: '/paths/~1product/get/parameters/0', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a parameter that the pinned operation lacks, by where the generated one is declared', () => {
    expect(compareOas(baseDocument(), withParameters([limit()]))).toEqual([
      { pointer: '/paths/~1product/get/parameters/0', kind: 'absent-from-pinned' },
    ]);
  });

  it('finds a parameter whose requirement differs', () => {
    expect(compareOas(withParameters([limit()]), withParameters([limit({ required: true })]))).toEqual([
      { pointer: '/paths/~1product/get/parameters/0/required', kind: 'differs' },
    ]);
  });

  it('finds a constraint inside the schema of a parameter', () => {
    const generated = withParameters([limit({ schema: { type: 'integer', maximum: 500 } })]);
    expect(compareOas(withParameters([limit()]), generated)).toEqual([
      { pointer: '/paths/~1product/get/parameters/0/schema/maximum', kind: 'differs' },
    ]);
  });

  it('takes a parameter with the same name in another place as another parameter', () => {
    const inHeader = limit({ in: 'header' });
    expect(pointersOfPair(withParameters([limit()]), withParameters([inHeader]))).toHaveLength(2);
  });

  it('ignores the description of a parameter', () => {
    expect(compareOas(withParameters([limit()]), withParameters([limit({ description: 'How many' })]))).toEqual([]);
  });

  it('reads a parameter given by reference and the same parameter written inline as equal', () => {
    const pinned = withMember(
      withParameters([{ $ref: '#/components/parameters/Limit' }]),
      ['components'],
      'parameters',
      { Limit: limit() },
    );
    expect(compareOas(pinned, withParameters([limit()]))).toEqual([]);
  });

  it('reads a parameter declared for the whole path as one of each of its operations', () => {
    const atPath = withMember(copyOf(baseDocument()), ['paths', '/product'], 'parameters', [limit()]);
    const pinned = withMember(atPath, ['paths', '/product', 'post'], 'parameters', []);
    const generated = withMember(withParameters([limit()]), ['paths', '/product', 'post'], 'parameters', [limit()]);
    expect(compareOas(pinned, generated)).toEqual([]);
  });

  it('lets a parameter of the operation override the one of the path with the same name and place', () => {
    const atPath = withMember(copyOf(baseDocument()), ['paths', '/product'], 'parameters', [
      limit({ required: false }),
    ]);
    const pinned = withMember(atPath, GET, 'parameters', [limit({ required: true })]);
    const generated = withParameters([limit({ required: true })]);
    expect(pointersOfPair(pinned, generated).filter((pointer) => pointer.includes('/get/'))).toEqual([]);
  });
});

describe('comparing the headers and the requirement of a body', () => {
  const OK = ['paths', '/product', 'get', 'responses', '200'];
  const link = { schema: { type: 'string' } };
  const withHeaders = (headers: Record<string, unknown>) => withMember(copyOf(baseDocument()), OK, 'headers', headers);

  it('finds the headers that a response of the generated document lacks', () => {
    expect(compareOas(withHeaders({ Link: link }), baseDocument())).toEqual([
      { pointer: '/paths/~1product/get/responses/200/headers', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a header that the generated response lacks, among others', () => {
    expect(compareOas(withHeaders({ Link: link, 'X-Total-Count': link }), withHeaders({ Link: link }))).toEqual([
      { pointer: '/paths/~1product/get/responses/200/headers/X-Total-Count', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a header whose schema differs, and ignores its description', () => {
    const generated = withHeaders({ Link: { schema: { type: 'integer' }, description: 'Another' } });
    expect(compareOas(withHeaders({ Link: link }), generated)).toEqual([
      { pointer: '/paths/~1product/get/responses/200/headers/Link/schema/type', kind: 'differs' },
    ]);
  });

  it('finds a request body that is required in one document and not in the other', () => {
    const BODY = ['paths', '/product', 'post', 'requestBody'];
    const pinned = withMember(copyOf(baseDocument()), BODY, 'required', true);
    expect(compareOas(pinned, baseDocument())).toEqual([
      { pointer: '/paths/~1product/post/requestBody/required', kind: 'differs' },
    ]);
  });

  it('reads a body that says required false and one that says nothing as the same', () => {
    const BODY = ['paths', '/product', 'post', 'requestBody'];
    expect(compareOas(withMember(copyOf(baseDocument()), BODY, 'required', false), baseDocument())).toEqual([]);
  });
});
