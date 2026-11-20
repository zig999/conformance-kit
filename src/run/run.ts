import { join } from 'node:path';
import type { ICtkContext } from '../ctk/context.js';
import { ensureDocker, ensureNetwork, runKitContainer, type IKitOutcome } from '../ctk/kit-run.js';
import { kitHostNameOf } from '../ctk/kit-configuration.js';
import type { IFiles } from '../shared/ports.js';
import { startModule } from '../ctk/module-start.js';
import { deviationsApplied } from '../deviations/applied.js';
import { readDeviationRegisterFrom, type IDeviationRegister } from '../deviations/register.js';
import { runPublishedComparison } from '../layers/published-comparison.js';
import { runTestLayers } from '../layers/test-layer.js';
import { EXIT_CONFIGURATION_REFUSED, exitCodeOf } from '../report/exit-codes.js';
import {
  RESULT_FAILED,
  RESULT_NOT_APPLICABLE,
  RESULT_NOT_RUN,
  RESULT_PASSED,
  buildReport,
  notRunResults,
  recordRun,
  reportPathOf,
  type ILayerResults,
  type KitResult,
} from '../report/record.js';
import { withoutConformanceVariables } from '../shared/environment.js';
import type { IRunEffects } from '../shared/effects.js';
import { ConfigurationError, describeError } from '../shared/errors.js';
import { createRedactor, secretsOfAuthorization } from '../shared/redaction.js';
import { Teardown } from '../shared/teardown.js';
import { selectApi } from './select-api.js';
import {
  kitDirectoryVariableOf,
  readKitSettings,
  readSettings,
  type IKitSettings,
  type ISettings,
} from './settings.js';
import type { IApiConformance, IApiWithKit, IConformanceRun } from './types.js';

const ACCESS_TOKEN_VARIABLE = 'CONFORMANCE_ACCESS_TOKEN';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface IFacts {
  readonly results: Mutable<ILayerResults>;
  differences: readonly string[];
  outcome: IKitOutcome | undefined;
  configurationRefused: boolean;
  kitDidNotRun: boolean;
  teardownFailed: boolean;
}

interface IPreparedKit {
  readonly api: IApiWithKit;
  readonly settings: IKitSettings;
  /** The host name the config.json of the kit uses for the module. */
  readonly hostName: string;
}

interface IPrepared {
  readonly settings: ISettings;
  readonly kit: IPreparedKit | undefined;
  readonly register: IDeviationRegister;
}

interface IRunContext {
  readonly effects: IRunEffects;
  readonly run: IConformanceRun;
  readonly api: IApiConformance;
  readonly signal: AbortSignal;
  readonly facts: IFacts;
}

async function readKitConfiguration(files: IFiles, kitDirectory: string): Promise<string> {
  try {
    return await files.readText(join(kitDirectory, 'config.json'));
  } catch (cause) {
    throw new ConfigurationError('the config.json of the kit cannot be read', {}, { cause });
  }
}

async function prepareKit(effects: IRunEffects, run: IConformanceRun, api: IApiWithKit): Promise<IPreparedKit> {
  const variable = kitDirectoryVariableOf(api.api, run.apis.length > 1);
  const settings = readKitSettings(run.environment, api.kit, variable);
  const hostName = kitHostNameOf(await readKitConfiguration(effects.files, settings.kitDirectory));
  return { api, settings, hostName };
}

async function prepare(effects: IRunEffects, run: IConformanceRun, api: IApiConformance): Promise<IPrepared> {
  const settings = readSettings(run.environment);
  const kit = api.withoutKit === true ? undefined : await prepareKit(effects, run, api);
  const { specificationRoot, conformanceNode } = api;
  return {
    settings,
    kit,
    register: await readDeviationRegisterFrom(effects.files, specificationRoot, conformanceNode),
  };
}

async function runLayers(rc: IRunContext, prepared: IPrepared): Promise<void> {
  const { effects, run, api, signal, facts } = rc;
  const tests = await runTestLayers(effects, {
    pinnedCopyTests: api.pinnedCopyTests,
    answerValidationTests: api.answerValidationTests,
    moduleDirectory: run.moduleDirectory,
    environment: withoutConformanceVariables(run.environment),
    timeoutMillis: prepared.settings.runTimeoutMillis,
    signal,
  });
  facts.results.pinnedCopyIdentity = tests.pinnedCopyIdentity;
  facts.results.answerValidation = tests.answerValidation;
  if (!signal.aborted) {
    const input = { pinnedOas: api.pinnedOas, generatedOas: api.generatedOas };
    const comparison = await runPublishedComparison(effects, input, prepared.register);
    facts.results.publishedDocumentComparison = comparison.result;
    facts.differences = comparison.differences;
  }
}

function ctkContext(rc: IRunContext, prepared: IPrepared, kit: IPreparedKit): ICtkContext {
  return {
    effects: rc.effects,
    teardown: new Teardown(rc.effects.log),
    signal: rc.signal,
    settings: {
      kitDirectory: kit.settings.kitDirectory,
      authorization: kit.settings.authorization,
      serviceUrl: kit.settings.serviceUrl,
      startTimeoutMillis: prepared.settings.startTimeoutMillis,
      runTimeoutMillis: prepared.settings.runTimeoutMillis,
      stepTimeoutMillis: prepared.settings.stepTimeoutMillis,
      environment: withoutConformanceVariables(rc.run.environment),
    },
  };
}

async function startAndRunKit(ctx: ICtkContext, kit: IPreparedKit, register: IDeviationRegister): Promise<IKitOutcome> {
  const { module } = kit.api;
  await ensureDocker(ctx);
  await ensureNetwork(ctx);
  const reach = await startModule(ctx, module, kit.hostName);
  return runKitContainer(ctx, reach, register);
}

async function runKitLayer(rc: IRunContext, prepared: IPrepared, kit: IPreparedKit): Promise<void> {
  const { effects, facts } = rc;
  const ctx = ctkContext(rc, prepared, kit);
  try {
    if (rc.signal.aborted) {
      throw new Error('the run was interrupted before the kit started');
    }
    facts.outcome = await startAndRunKit(ctx, kit, prepared.register);
  } catch (error) {
    facts.kitDidNotRun = true;
    effects.log(`the kit did not run to the end: ${describeError(error)}`);
  } finally {
    facts.teardownFailed = (await ctx.teardown.run()) > 0;
  }
  facts.results.conformanceKit = kitResultOf(facts.outcome);
}

function kitResultOf(outcome: IKitOutcome | undefined): KitResult {
  if (outcome === undefined) {
    return RESULT_NOT_RUN;
  }
  return outcome.passed ? RESULT_PASSED : RESULT_FAILED;
}

async function recordAndExit(rc: IRunContext, register: IDeviationRegister | undefined): Promise<number> {
  const { effects, run, api, facts } = rc;
  const report = buildReport({
    api: api.api,
    openapiVersion: api.openapiVersion,
    date: new Date(),
    results: facts.results,
    deviationsApplied: deviationsApplied(register, {
      failedItems: facts.outcome?.failedItems ?? [],
      differences: facts.differences,
    }),
  });
  const path = reportPathOf(run.moduleDirectory, api.api, run.apis.length > 1);
  const written = await recordRun(effects.files, { path, report }, effects.log);
  return exitCodeOf({
    configurationRefused: facts.configurationRefused,
    kitDidNotRun: facts.kitDidNotRun,
    teardownFailed: facts.teardownFailed,
    kitItemFailed: facts.outcome !== undefined && !facts.outcome.passed,
    recordNotWritten: !written,
  });
}

function logResults(rc: IRunContext): void {
  const { results } = rc.facts;
  rc.effects.log(`pinned copy identity: ${results.pinnedCopyIdentity}`);
  rc.effects.log(`published document comparison: ${results.publishedDocumentComparison}`);
  rc.effects.log(`answer validation: ${results.answerValidation}`);
  rc.effects.log(`conformance kit: ${results.conformanceKit}`);
}

function newFacts(): IFacts {
  return {
    results: notRunResults(),
    differences: [],
    outcome: undefined,
    configurationRefused: false,
    kitDidNotRun: false,
    teardownFailed: false,
  };
}

async function execute(rc: IRunContext): Promise<IDeviationRegister | undefined> {
  const { effects, run, api, signal, facts } = rc;
  let prepared: IPrepared;
  try {
    prepared = await prepare(effects, run, api);
  } catch (error) {
    facts.configurationRefused = error instanceof ConfigurationError;
    facts.kitDidNotRun = !facts.configurationRefused;
    effects.log(`the run was not started: ${describeError(error)}`);
    return undefined;
  }
  await runLayers(rc, prepared);
  if (prepared.kit === undefined) {
    facts.results.conformanceKit = RESULT_NOT_APPLICABLE;
    facts.kitDidNotRun = signal.aborted;
  } else {
    await runKitLayer(rc, prepared, prepared.kit);
  }
  return prepared.register;
}

/**
 * Runs the four layers of one API, then records the result and answers the exit code of CNF-11. The layers
 * before the kit run one after another and a failure does not stop the next. An API with no kit has no layer 4.
 * Everything the run says goes through the redactor, so the token never appears in a message.
 */
export async function runWith(effects: IRunEffects, run: IConformanceRun, signal: AbortSignal): Promise<number> {
  const redact = createRedactor(secretsOfAuthorization(run.environment[ACCESS_TOKEN_VARIABLE] ?? ''));
  const safe: IRunEffects = { ...effects, log: (message) => effects.log(redact(message)) };
  let api: IApiConformance;
  try {
    api = selectApi(run.apis, run.apiCode);
  } catch (error) {
    safe.log(`the run was not started: ${describeError(error)}`);
    return EXIT_CONFIGURATION_REFUSED;
  }
  const rc: IRunContext = { effects: safe, run, api, signal, facts: newFacts() };
  const register = await execute(rc);
  logResults(rc);
  return recordAndExit(rc, register);
}
