type Json = Record<string, unknown>;

const json = (schema: unknown): Json => ({ content: { 'application/json': { schema } } });
const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });

export const baseDocument = (): Json => ({
  openapi: '3.0.1',
  info: { title: 'Pinned', version: '5.0.0' },
  servers: [{ url: 'https://example.test' }],
  paths: {
    '/product': {
      get: {
        summary: 'List',
        responses: {
          '200': { description: 'ok', ...json({ type: 'array', items: ref('Product') }) },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        requestBody: json(ref('ProductCreate')),
        responses: { '201': { description: 'created', ...json(ref('Product')) } },
      },
    },
    '/product/{id}': { get: { responses: { '200': { description: 'ok', ...json(ref('Product')) } } } },
  },
  components: {
    responses: { NotFound: { description: 'not found', ...json(ref('Error')) } },
    schemas: {
      Product: {
        type: 'object',
        description: 'A product.',
        properties: { id: { type: 'string' }, status: ref('ProductStatusType') },
        required: ['id'],
      },
      ProductStatusType: { type: 'string', enum: ['created', 'active'] },
      ProductCreate: { type: 'object', allOf: [ref('Product'), { properties: { name: { type: 'string' } } }] },
      Error: { type: 'object', properties: { code: { type: 'string' } } },
    },
  },
});

export const copyOf = (document: Json): Json => structuredClone(document);

export const inPath = (document: Json, ...tokens: string[]): Json => {
  let node: unknown = document;
  for (const token of tokens) {
    node = typeof node === 'object' && node !== null ? Reflect.get(node, token) : undefined;
  }
  if (typeof node !== 'object' || node === null) {
    throw new Error(`no object at ${tokens.join('/')}`);
  }
  return node as Json;
};

export const without = (document: Json, tokens: string[], key: string): Json => {
  const copy = copyOf(document);
  Reflect.deleteProperty(inPath(copy, ...tokens), key);
  return copy;
};

export const withMember = (document: Json, tokens: string[], key: string, value: unknown): Json => {
  const copy = copyOf(document);
  Reflect.set(inPath(copy, ...tokens), key, value);
  return copy;
};
