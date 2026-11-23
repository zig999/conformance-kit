/** The deviation nodes that covered a difference or excluded an item in this run, without repetition (CNF-07). */
export function deviationsApplied(register, facts) {
    const failed = new Set(facts.failedItems);
    const differing = new Set(facts.differences);
    return (register?.entries ?? [])
        .filter((entry) => entry.excludedItems.some((identifier) => failed.has(identifier)) ||
        entry.coveredPointers.some((pointer) => differing.has(pointer)))
        .map((entry) => entry.node);
}
