import type { Environment } from './ports.js';
/** CNF-13: the run never hands a CONFORMANCE_* variable to what it starts. Variables with no value go too. */
export declare function withoutConformanceVariables(environment: Environment): Record<string, string>;
