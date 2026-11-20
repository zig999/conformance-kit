import { join } from 'node:path';
import type { ICtkContext } from '../ctk/context.js';
import { ensureDocker, ensureNetwork, runKitContainer, type IKitOutcome } from '../ctk/kit-run.js';
import { kitHostNameOf } from '../ctk/kit-configuration.js';
import { startModule } from '../ctk/module-start.js';
import { requireNothingRunning } from '../ctk/previous-run.js';
import { deviationsApplied } from '../deviations/applied.js';
import { readDeviationRegisterFrom, type IDeviationRegister } from '../deviations/register.js';
import { runPublishedComparison } from '../layers/published-comparison.js';
import { runTestLayers } from '../layers/test-layer.js';
import { exitCodeOf } from '../report/exit-codes.js';
import {
  RESULT_FAILED,
  RESULT_NOT_RUN,
  RESULT_PASSED,
  buildReport,
  notRunResults,
  recordRun,
  reportPathOf,
  type ILayerResults,
  type LayerResult,
} from '../report/record.js';
import { withoutConformanceVariables } from '../shared/environment.js';
import type { IRunEffects } from '../shared/effects.js';
import { ConfigurationError, describeError } from '../shared/errors.js';
import { createRedactor, secretsOfAuthorization } from '../shared/redaction.js';
import { Teardown } from '../shared/teardown.js';
import { readSettings, type ISettings } from './settings.js';
import type { IConformanceRun } from './types.js';

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

interface IPrepared {
  readonly settings: ISettings;
  readonly register: IDeviationRegister;
}

interface IRunContext {
  readonly effects: IRunEffects;
  readonly run: IConformanceRun;
  readonly signal: AbortSignal;
  readonly facts: IFacts;
}

async function prepare(effects: IRunEffects, run: IConformanceRun): Promise<IPrepared> {
  const settings = readSettings(run.environment, run.api.kit);
  const { specificationRoot, conformanceNode } = run.api;
  return { settings, register: await readDeviationRegisterFrom(effects.files, specificationRoot, conformanceNode) };
}

async function runLayers(rc: IRunContext, prepared: IPrepared): Promise<void> {
  const { effects, run, signal, facts } = rc;
  const tests = await runTestLayers(effects, {
    pinnedCopyTests: run.api.pinnedCopyTests,
    answerValidationTests: run.api.answerValidationTests,
    moduleDirectory: run.moduleDirectory,
    environment: withoutConformanceVariables(run.environment),
    timeoutMillis: prepared.settings.runTimeoutMillis,
    signal,
  });
  facts.results.pinnedCopyIdentity = tests.pinnedCopyIdentity;
  facts.results.answerValidation = tests.answerValidation;
  if (!signal.aborted) {
    const input = { pinnedOas: run.api.pinnedOas, generatedOas: run.api.generatedOas };
    const comparison = await runPublishedComparison(effects, input, prepared.register);
    facts.results.publishedDocumentComparison = comparison.result;
    facts.differences = comparison.differences;
  }
}

function ctkContext(rc: IRunContext, prepared: IPrepared, teardown: Teardown): ICtkContext {
  const { settings } = prepared;
  return {
    effects: rc.effects,
    teardown,
    signal: rc.signal,
    settings: {
      kitDirectory: settings.kitDirectory,
      authorization: settings.authorization,
      serviceUrl: settings.serviceUrl,
      startTimeoutMillis: settings.startTimeoutMillis,
      runTimeoutMillis: settings.runTimeoutMillis,
      stepTimeoutMillis: settings.stepTimeoutMillis,
      environment: withoutConformanceVariables(rc.run.environment),
    },
  };
}

async function startAndRunKit(ctx: ICtkContext, rc: IRunContext, prepared: IPrepared): Promise<IKitOutcome> {
  const { module } = rc.run.api;
  await ensureDocker(ctx);
  if (module.mode === 'compose') {
    await requireNothingRunning(ctx, module);
  }
  await ensureNetwork(ctx);
  const kitText = await rc.effects.files.readText(join(prepared.settings.kitDirectory, 'config.json'));
  const reach = await startModule(ctx, module, kitHostNameOf(kitText));
  return runKitContainer(ctx, reach, prepared.register);
}

async function runKitLayer(rc: IRunContext, prepared: IPrepared): Promise<void> {
  const { effects, facts } = rc;
  const teardown = new Teardown(effects.log);
  try {
    if (rc.signal.aborted) {
      throw new Error('the run was interrupted before the kit started');
    }
    facts.outcome = await startAndRunKit(ctkContext(rc, prepared, teardown), rc, prepared);
  } catch (error) {
    facts.kitDidNotRun = true;
    effects.log(`the kit did not run to the end: ${describeError(error)}`);
  } finally {
    facts.teardownFailed = (await teardown.run()) > 0;
  }
}

function kitResultOf(outcome: IKitOutcome | undefined): LayerResult {
  if (outcome === undefined) {
    return RESULT_NOT_RUN;
  }
  return outcome.passed ? RESULT_PASSED : RESULT_FAILED;
}

async function recordAndExit(rc: IRunContext, register: IDeviationRegister | undefined): Promise<number> {
  const { effects, run, facts } = rc;
  const report = buildReport({
    api: run.api.api,
    openapiVersion: run.api.openapiVersion,
    date: new Date(),
    results: facts.results,
    deviationsApplied: deviationsApplied(register, {
      failedItems: facts.outcome?.failedItems ?? [],
      differences: facts.differences,
    }),
  });
  const path = reportPathOf(run.moduleDirectory, run.api.api, run.api.severalApisInModule ?? false);
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

/**
 * Runs the four layers of one API, then records the result and answers the exit code of CNF-11. The layers
 * before the kit run one after another and a failure does not stop the next. Everything the run says goes
 * through the redactor, so the token never appears in a message.
 */
export async function runWith(effects: IRunEffects, run: IConformanceRun, signal: AbortSignal): Promise<number> {
  const redact = createRedactor(secretsOfAuthorization(run.environment[ACCESS_TOKEN_VARIABLE] ?? ''));
  const safe: IRunEffects = { ...effects, log: (message) => effects.log(redact(message)) };
  const facts: IFacts = {
    results: notRunResults(),
    differences: [],
    outcome: undefined,
    configurationRefused: false,
    kitDidNotRun: false,
    teardownFailed: false,
  };
  const rc: IRunContext = { effects: safe, run, signal, facts };
  let prepared: IPrepared | undefined;
  try {
    prepared = await prepare(safe, run);
  } catch (error) {
    facts.configurationRefused = error instanceof ConfigurationError;
    facts.kitDidNotRun = !facts.configurationRefused;
    safe.log(`the run was not started: ${describeError(error)}`);
  }
  if (prepared !== undefined) {
    await runLayers(rc, prepared);
    await runKitLayer(rc, prepared);
  }
  rc.facts.results.conformanceKit = kitResultOf(rc.facts.outcome);
  logResults(rc);
  return recordAndExit(rc, prepared?.register);
}
