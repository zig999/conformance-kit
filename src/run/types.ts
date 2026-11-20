import type { IExpectedKit } from '../ctk/kit-directory.js';
import type { IModuleUnderTest } from '../ctk/module-types.js';
import type { Environment } from '../shared/ports.js';

/** What every API declares so that the kit can verify layers 1 to 3 (CNF-09). */
interface IApiLayers {
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
}

/** An API with a kit in `../tmforum`: layer 4 runs. */
export interface IApiWithKit extends IApiLayers {
  readonly withoutKit?: false;
  /** The folder of the official kit, held in the tmforum directory. */
  readonly kit: IExpectedKit;
  readonly module: IModuleUnderTest;
}

/**
 * An API with no kit in `../tmforum`: layers 1 to 3 run, layer 4 does not, and the report says `not-applicable`.
 * No docker, no module to start and none of the variables of the kit.
 */
export interface IApiWithoutKit extends IApiLayers {
  readonly withoutKit: true;
}

export type IApiConformance = IApiWithKit | IApiWithoutKit;

/** One run: `backend/scripts/conformance.ts` builds this and calls `runConformance`. */
export interface IConformanceRun {
  /** The environment of the process. The kit never reads it by itself. */
  readonly environment: Environment;
  /** The `backend/` directory: where the tests run and the report is written. */
  readonly moduleDirectory: string;
  /** Every API of the module. */
  readonly apis: readonly IApiConformance[];
  /**
   * The code of the API to run, such as `tmf632`, in any case: the argument of `backend/scripts/conformance.ts`.
   * Needed when the module has several APIs; with one API it may be left out.
   */
  readonly apiCode?: string | undefined;
  /** Every fact the kit reports, one line at a time. The token never appears in it. */
  readonly log: (message: string) => void;
  /** The output of the CTK and of the tests, as it comes. The token never appears in it. */
  readonly output?: (chunk: string) => void;
}
