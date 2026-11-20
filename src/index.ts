export { runConformance } from './run/run-conformance.js';
export type { IApiConformance, IApiWithKit, IApiWithoutKit, IConformanceRun } from './run/types.js';
export type {
  IComposeModule,
  IModuleCommand,
  IModuleRuntime,
  IModuleUnderTest,
  IProcessModule,
  IStandIn,
  IStandInHandle,
} from './ctk/module-types.js';
export type { IExpectedKit } from './ctk/kit-directory.js';
export {
  EXIT_CONFIGURATION_REFUSED,
  EXIT_KIT_COMPLETED,
  EXIT_KIT_DID_NOT_RUN,
  EXIT_KIT_ITEM_FAILED,
  EXIT_RECORD_NOT_WRITTEN,
  EXIT_TEARDOWN_FAILED,
} from './report/exit-codes.js';
export { compareOas } from './oas/compare.js';
export type { IOasDifference, OasDifferenceKind } from './oas/compare.js';
export { readOasFile, sha256OfFile } from './oas/read.js';
export { readDeviationRegister } from './deviations/register.js';
export type { IDeviation, IDeviationRegister } from './deviations/register.js';
export { ConfigurationError, ConformanceError, KitDidNotRunError } from './shared/errors.js';
