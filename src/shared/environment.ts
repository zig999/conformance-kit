import type { Environment } from './ports.js';

const CONFORMANCE_PREFIX = 'CONFORMANCE_';

/** CNF-13: the run never hands a CONFORMANCE_* variable to what it starts. Variables with no value go too. */
export function withoutConformanceVariables(environment: Environment): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined && !name.startsWith(CONFORMANCE_PREFIX)) {
      kept[name] = value;
    }
  }
  return kept;
}
