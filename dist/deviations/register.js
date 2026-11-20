import { ConfigurationError } from '../shared/errors.js';
import { createNodeFiles } from '../shared/node-files.js';
import { excludedNodesOf, readFrontmatter, statementOf } from './frontmatter.js';
import { namesOf } from './statement.js';
const CONSTRAINTS_NODE = /^constraints\/[a-z0-9]+(-[a-z0-9]+)*$/;
function assertConstraintsNode(node, origin) {
    if (!CONSTRAINTS_NODE.test(node)) {
        throw new ConfigurationError(`${origin} names the node ${node}, which is not a constraints node`, { node });
    }
}
async function entryOf(files, specificationRoot, node) {
    const statement = statementOf(await readFrontmatter(files, specificationRoot, node), node);
    const { pointers, items } = namesOf(statement, node);
    return { node, coveredPointers: pointers, excludedItems: items };
}
function registerOf(entries) {
    const covered = new Set(entries.flatMap((entry) => entry.coveredPointers));
    const excluded = new Set(entries.flatMap((entry) => entry.excludedItems));
    return {
        entries,
        isCovered: (pointer) => covered.has(pointer),
        isExcluded: (identifier) => excluded.has(identifier),
    };
}
/** Reads the conformance node and every deviation node its `excludes:` block lists (CNF-05, CNF-06). */
export async function readDeviationRegisterFrom(files, specificationRoot, conformanceNode) {
    assertConstraintsNode(conformanceNode, 'the conformance node');
    const conformance = await readFrontmatter(files, specificationRoot, conformanceNode);
    const nodes = [...new Set(excludedNodesOf(conformance))];
    nodes.forEach((node) => assertConstraintsNode(node, conformanceNode));
    return registerOf(await Promise.all(nodes.map((node) => entryOf(files, specificationRoot, node))));
}
export function readDeviationRegister(specificationRoot, conformanceNode) {
    return readDeviationRegisterFrom(createNodeFiles(), specificationRoot, conformanceNode);
}
