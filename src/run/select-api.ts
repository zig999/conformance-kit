import { ConfigurationError } from '../shared/errors.js';
import type { IApiConformance } from './types.js';

/**
 * CNF-04, CNF-07: the API to run is named by its code, in any case. A module with one API may leave the code out;
 * a module with several must name one. A code that no API has refuses the run.
 */
export function selectApi(apis: readonly IApiConformance[], code: string | undefined): IApiConformance {
  const codes = apis.map((api) => api.api).join(', ');
  const wanted = (code ?? '').trim().toLowerCase();
  const [only] = apis;
  if (only === undefined) {
    throw new ConfigurationError('the module declares no API');
  }
  if (wanted === '') {
    if (apis.length > 1) {
      throw new ConfigurationError(`the module has several APIs, so the run must name one of them: ${codes}`);
    }
    return only;
  }
  const found = apis.find((api) => api.api.toLowerCase() === wanted);
  if (found === undefined) {
    throw new ConfigurationError(`no API of the module has the code ${wanted.toUpperCase()}; its APIs are: ${codes}`);
  }
  return found;
}
