import type { IApiConformance } from './types.js';
/**
 * CNF-04, CNF-07: the API to run is named by its code, in any case. A module with one API may leave the code out;
 * a module with several must name one. A code that no API has refuses the run.
 */
export declare function selectApi(apis: readonly IApiConformance[], code: string | undefined): IApiConformance;
