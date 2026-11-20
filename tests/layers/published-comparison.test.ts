import { stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
import { runPublishedComparison } from '../../src/layers/published-comparison.js';
import { readDeviationRegisterFrom } from '../../src/deviations/register.js';
import { CONFORMANCE_NODE, SPECIFICATION_ROOT, nodeText, specificationWith } from '../support/deviation-nodes.js';
import { MemoryFiles } from '../support/memory-files.js';
import { baseDocument, copyOf, withMember, without } from '../support/oas-documents.js';

const PINNED = '/contracts/pinned.oas.yaml';
const DEVIATION = 'constraints/tmf999-no-delete';

const files = (): MemoryFiles => new MemoryFiles().seed(PINNED, stringify(baseDocument()));

const registerCovering = (statement: string) =>
  readDeviationRegisterFrom(
    specificationWith({ [DEVIATION]: nodeText(`statement: ${statement}`) }),
    SPECIFICATION_ROOT,
    CONFORMANCE_NODE,
  );

const run = async (generated: () => Promise<unknown>, statement = 'Nothing is covered.') => {
  const log: string[] = [];
  const register = await registerCovering(statement);
  const outcome = await runPublishedComparison(
    { files: files(), log: (message) => log.push(message) },
    { pinnedOas: PINNED, generatedOas: generated },
    register,
  );
  return { outcome, log };
};

describe('the comparison of the published document (layer 2)', () => {
  it('passes when the documents are equivalent', async () => {
    const { outcome } = await run(async () => copyOf(baseDocument()));
    expect(outcome).toEqual({ result: 'passed', differences: [] });
  });

  it('fails when a difference is covered by no deviation, and names the pointer', async () => {
    const generated = without(baseDocument(), ['paths', '/product'], 'post');
    const { outcome, log } = await run(async () => generated);
    expect(outcome).toEqual({ result: 'failed', differences: ['/paths/~1product/post'] });
    expect(log.join('\n')).toContain('/paths/~1product/post');
  });

  it('passes when every difference is covered by a deviation, and reports the differences for the record', async () => {
    const generated = without(baseDocument(), ['paths', '/product'], 'post');
    const { outcome } = await run(async () => generated, 'Covers "/paths/~1product/post".');
    expect(outcome).toEqual({ result: 'passed', differences: ['/paths/~1product/post'] });
  });

  it('fails when only some of the differences are covered', async () => {
    let generated = without(baseDocument(), ['paths', '/product'], 'post');
    generated = withMember(generated, ['components', 'schemas'], 'Extra', { type: 'object' });
    const { outcome } = await run(async () => generated, 'Covers "/paths/~1product/post".');
    expect(outcome.result).toBe('failed');
    expect(outcome.differences).toHaveLength(2);
  });

  it('fails, and says why, when the pinned document cannot be read', async () => {
    const log: string[] = [];
    const register = await registerCovering('Nothing.');
    const outcome = await runPublishedComparison(
      { files: new MemoryFiles(), log: (message) => log.push(message) },
      { pinnedOas: PINNED, generatedOas: async () => baseDocument() },
      register,
    );
    expect(outcome).toEqual({ result: 'failed', differences: [] });
    expect(log.join('\n')).toContain(PINNED);
  });

  it('fails, and says why, when the generated document cannot be produced', async () => {
    const { outcome, log } = await run(async () => {
      throw new Error('the application did not start');
    });
    expect(outcome).toEqual({ result: 'failed', differences: [] });
    expect(log.join('\n')).toContain('the application did not start');
  });

  it('fails when the generated document is not an OpenAPI document', async () => {
    const { outcome } = await run(async () => 'not a document');
    expect(outcome.result).toBe('failed');
  });
});
