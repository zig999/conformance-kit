import { recordOf } from './difference.js';
import { pathDifferences } from './operations.js';
import { schemaSetDifferences } from './schemas.js';
function withoutRepeats(differences) {
    const seen = new Set();
    return differences.filter((difference) => {
        const key = `${difference.pointer}\u0000${difference.kind}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
/**
 * Compares the generated document with the pinned one on paths, operations, schemas, states and response codes (CNF-02).
 * Metadata (openapi, info, servers, tags) and prose (description, summary, example) are not part of the contract.
 */
export function compareOas(pinned, generated) {
    const roots = { pinned: recordOf(pinned), generated: recordOf(generated) };
    return withoutRepeats([...pathDifferences(roots), ...schemaSetDifferences(roots)]);
}
