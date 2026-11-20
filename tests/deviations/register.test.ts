import { describe, expect, it } from 'vitest';
import { readDeviationRegisterFrom } from '../../src/deviations/register.js';
import { ConfigurationError } from '../../src/shared/errors.js';
import {
  CONFORMANCE_NODE,
  SPECIFICATION_ROOT,
  conformanceNodeText,
  nodeText,
  specification,
  specificationWith,
} from '../support/deviation-nodes.js';

const DEVIATION = 'constraints/tmf999-listener-is-not-supported';
const registerOf = (statementLines: string) =>
  readDeviationRegisterFrom(
    specificationWith({ [DEVIATION]: nodeText(statementLines) }),
    SPECIFICATION_ROOT,
    CONFORMANCE_NODE,
  );

describe('reading a deviation node', () => {
  it('reads the pointers between double quotes and the items between grave accents', async () => {
    const register = await registerOf(
      'statement: Differs at "/paths/~1hub/post/responses/201" and excludes `POST /hub returns 201`.',
    );
    expect(register.entries).toEqual([
      {
        node: DEVIATION,
        coveredPointers: ['/paths/~1hub/post/responses/201'],
        excludedItems: ['POST /hub returns 201'],
      },
    ]);
  });

  it('reads a statement written as a plain scalar over several lines', async () => {
    const register = await registerOf('statement: First line `item one`\n  second line "/a/b"');
    expect(register.entries[0]).toMatchObject({ coveredPointers: ['/a/b'], excludedItems: ['item one'] });
  });

  it('reads a folded statement (>)', async () => {
    const register = await registerOf('statement: >\n  Folded `item one`\n  and "/a/b".');
    expect(register.entries[0]).toMatchObject({ coveredPointers: ['/a/b'], excludedItems: ['item one'] });
  });

  it('reads a literal statement (|)', async () => {
    const register = await registerOf('statement: |\n  Literal `item one`\n  and "/a/b".');
    expect(register.entries[0]).toMatchObject({ coveredPointers: ['/a/b'], excludedItems: ['item one'] });
  });

  it('reads a pointer written with an escaped quotation mark as a JSON string', async () => {
    const register = await registerOf('statement: The key "/a/with \\" quote".');
    expect(register.entries[0]?.coveredPointers).toEqual(['/a/with " quote']);
  });

  it('lists each pointer and each item once', async () => {
    const register = await registerOf('statement: Covers "/a" "/a" `x` `x`');
    expect(register.entries[0]).toMatchObject({ coveredPointers: ['/a'], excludedItems: ['x'] });
  });

  it('finds no deviation when the conformance node excludes none', async () => {
    const register = await readDeviationRegisterFrom(
      specification({ [CONFORMANCE_NODE]: conformanceNodeText() }),
      SPECIFICATION_ROOT,
      CONFORMANCE_NODE,
    );
    expect(register.entries).toEqual([]);
  });

  it('reads one entry per excluded node, even when the conformance node lists a node twice', async () => {
    const files = specification({
      [CONFORMANCE_NODE]: conformanceNodeText(DEVIATION, DEVIATION),
      [DEVIATION]: nodeText('statement: `x`'),
    });
    const register = await readDeviationRegisterFrom(files, SPECIFICATION_ROOT, CONFORMANCE_NODE);
    expect(register.entries).toHaveLength(1);
  });
});

describe('refusing a deviation node', () => {
  const refused = (statement: string) => expect(registerOf(statement)).rejects;

  it.each([
    ['a quoted scalar', 'statement: "A quoted statement."'],
    ['a single-quoted scalar', "statement: 'A quoted statement.'"],
    ['an inline list', 'statement: [`a`, `b`]'],
    ['an inline map', 'statement: {key: value}'],
    ['a block list', 'statement:\n  - `a`\n  - `b`'],
  ])('refuses a statement written as %s', async (_name, statement) => {
    await refused(statement).toBeInstanceOf(ConfigurationError);
    await refused(statement).toThrow(DEVIATION);
  });

  it('refuses a grave accent that no second one closes', async () => {
    await refused('statement: An `item that never closes').toThrow(/grave accent/);
  });

  it('refuses a quotation mark that no second one closes', async () => {
    await refused('statement: A pointer "/never/closes').toThrow(/quotation mark/);
  });

  it('refuses a quoted text that is not a JSON string', async () => {
    await refused('statement: A pointer "\\x" is not JSON').toThrow(/not a JSON string/);
  });

  it('refuses a pair of grave accents with nothing between them', async () => {
    await refused('statement: An empty pair `` here').toThrow(/no identifier/);
  });

  it('refuses a node with no statement', async () => {
    await refused('title: no statement here').toThrow(/no statement/);
  });

  it('refuses a node without frontmatter', async () => {
    const files = specification({
      [CONFORMANCE_NODE]: conformanceNodeText(DEVIATION),
      [DEVIATION]: 'No frontmatter at all.\n',
    });
    const reading = readDeviationRegisterFrom(files, SPECIFICATION_ROOT, CONFORMANCE_NODE);
    await expect(reading).rejects.toBeInstanceOf(ConfigurationError);
    await expect(reading).rejects.toThrow(/frontmatter/);
  });

  it('refuses a frontmatter that is never closed', async () => {
    const files = specification({
      [CONFORMANCE_NODE]: conformanceNodeText(DEVIATION),
      [DEVIATION]: '---\nstatement: `x`\n',
    });
    await expect(readDeviationRegisterFrom(files, SPECIFICATION_ROOT, CONFORMANCE_NODE)).rejects.toThrow(/frontmatter/);
  });

  it('refuses an excluded node that does not exist', async () => {
    const files = specification({ [CONFORMANCE_NODE]: conformanceNodeText(DEVIATION) });
    const reading = readDeviationRegisterFrom(files, SPECIFICATION_ROOT, CONFORMANCE_NODE);
    await expect(reading).rejects.toBeInstanceOf(ConfigurationError);
    await expect(reading).rejects.toThrow(DEVIATION);
  });

  it('refuses a conformance node that does not exist', async () => {
    const reading = readDeviationRegisterFrom(specification({}), SPECIFICATION_ROOT, CONFORMANCE_NODE);
    await expect(reading).rejects.toBeInstanceOf(ConfigurationError);
  });

  it.each([
    'constraints/Upper-Case',
    'constraints/with_underscore',
    'other/some-node',
    'constraints/a--b',
    '../escape',
  ])('refuses the excluded node identifier %s', async (identifier) => {
    const files = specification({ [CONFORMANCE_NODE]: conformanceNodeText(identifier) });
    const reading = readDeviationRegisterFrom(files, SPECIFICATION_ROOT, CONFORMANCE_NODE);
    await expect(reading).rejects.toBeInstanceOf(ConfigurationError);
    await expect(reading).rejects.toThrow(/not a constraints node/);
  });

  it('refuses a conformance node identifier outside the pattern', async () => {
    const reading = readDeviationRegisterFrom(specification({}), SPECIFICATION_ROOT, 'constraints/../x');
    await expect(reading).rejects.toThrow(/not a constraints node/);
  });
});

describe('what a register covers', () => {
  it('covers a pointer and excludes an item that a deviation names, and no other', async () => {
    const register = await registerOf('statement: Covers "/covered" and `excluded item`');
    expect(register.isCovered('/covered')).toBe(true);
    expect(register.isCovered('/other')).toBe(false);
    expect(register.isExcluded('excluded item')).toBe(true);
    expect(register.isExcluded('other item')).toBe(false);
  });

  it('does not take a pointer for an item or an item for a pointer', async () => {
    const register = await registerOf('statement: Covers "/covered" and `excluded item`');
    expect(register.isCovered('excluded item')).toBe(false);
    expect(register.isExcluded('/covered')).toBe(false);
  });
});
