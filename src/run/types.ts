import type { IExpectedKit } from '../ctk/kit-directory.js';
import type { IModuleUnderTest } from '../ctk/module-types.js';
import type { Environment } from '../shared/ports.js';

/** One API of a module: everything the module declares so that the kit can verify it (CNF-09). */
export interface IApiConformance {
  /** The code of the API, as in the report: `TMF637`. */
  readonly api: string;
  /** The version of the pinned OAS: `5.0.0`. */
  readonly openapiVersion: string;
  /** The OAS pinned in `backend/contracts/` (CNF-01). */
  readonly pinnedOas: string;
  /** Builds the OAS the module publishes, to compare with the pinned one (CNF-02). */
  readonly generatedOas: () => Promise<unknown>;
  /** The test files of layer 1, run in `moduleDirectory` (CNF-01). */
  readonly pinnedCopyTests: readonly string[];
  /** The test files of layer 3, run in `moduleDirectory` (CNF-03). */
  readonly answerValidationTests: readonly string[];
  /** The conformance node, `constraints/tmfNNN-conformance` (CNF-05). */
  readonly conformanceNode: string;
  /** The root of the specification that holds the conformance node and the deviation nodes. */
  readonly specificationRoot: string;
  /** The folder of the official CTK, held in the tmforum directory. */
  readonly kit: IExpectedKit;
  readonly module: IModuleUnderTest;
  /** True when the module has more than one API: the report is then `conformance-report.<api>.json` (CNF-07). */
  readonly severalApisInModule?: boolean;
}

/** One run: `backend/scripts/conformance.ts` builds this and calls `runConformance`. */
export interface IConformanceRun {
  /** The environment of the process. The kit never reads it by itself. */
  readonly environment: Environment;
  /** The `backend/` directory: where the tests run and the report is written. */
  readonly moduleDirectory: string;
  readonly api: IApiConformance;
  /** Every fact the kit reports, one line at a time. The token never appears in it. */
  readonly log: (message: string) => void;
  /** The output of the CTK and of the tests, as it comes. The token never appears in it. */
  readonly output?: (chunk: string) => void;
}
