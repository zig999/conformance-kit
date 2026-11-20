import { describe, expect, it } from 'vitest';
import { compareOas } from '../../src/oas/compare.js';
import { baseDocument, copyOf, withMember, without } from '../support/oas-documents.js';

const pinned = baseDocument();
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

  it('finds a state that the generated document lacks, with the pointer of the pinned one', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'ProductStatusType'], 'enum', ['created']);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/ProductStatusType/enum/1', kind: 'absent-from-generated' },
    ]);
  });

  it('finds a state that the pinned document lacks', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'ProductStatusType'], 'enum', [
      'created',
      'active',
      'cancelled',
    ]);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/ProductStatusType/enum/2', kind: 'absent-from-pinned' },
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

  it('finds a member that is required in one document and not in the other', () => {
    const generated = withMember(copyOf(pinned), ['components', 'schemas', 'Product'], 'required', []);
    expect(compareOas(pinned, generated)).toEqual([
      { pointer: '/components/schemas/Product/properties/id', kind: 'differs' },
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
