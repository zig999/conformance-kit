import { join } from 'node:path';
import { z } from 'zod';
import { describeError } from '../shared/errors.js';
import type { IFiles } from '../shared/ports.js';

const REPORT_FILE = 'conformance-report.json';
const JSON_INDENT = 2;
const NODE_IDENTITY = /^constraints\/[a-z0-9]+(-[a-z0-9]+)*$/;
const API_CODE = /^[A-Za-z0-9]+$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export const RESULT_PASSED = 'passed';
export const RESULT_FAILED = 'failed';
export const RESULT_NOT_RUN = 'not-run';
export const RESULT_NOT_APPLICABLE = 'not-applicable';

const ResultSchema = z.enum([RESULT_PASSED, RESULT_FAILED, RESULT_NOT_RUN]);
/** An API with no kit in tmforum has no layer 4: only `conformanceKit` may say so. */
const KitResultSchema = z.enum([RESULT_PASSED, RESULT_FAILED, RESULT_NOT_RUN, RESULT_NOT_APPLICABLE]);
const areDistinct = (nodes: readonly string[]): boolean => new Set(nodes).size === nodes.length;

/** CNF-07: strict, so that an unknown key is refused. */
export const ConformanceReportSchema = z.strictObject({
  api: z.string().regex(API_CODE),
  openapiVersion: z.string().regex(VERSION),
  date: z.iso.datetime({ offset: true }),
  results: z.strictObject({
    pinnedCopyIdentity: ResultSchema,
    publishedDocumentComparison: ResultSchema,
    answerValidation: ResultSchema,
    conformanceKit: KitResultSchema,
  }),
  deviationsApplied: z
    .array(z.string().regex(NODE_IDENTITY))
    .refine(areDistinct, { message: 'must not list a deviation twice' }),
});

export type IConformanceReport = z.output<typeof ConformanceReportSchema>;
export type LayerResult = z.output<typeof ResultSchema>;
export type KitResult = z.output<typeof KitResultSchema>;
export type ILayerResults = IConformanceReport['results'];

export interface IReportFacts {
  readonly api: string;
  readonly openapiVersion: string;
  readonly date: Date;
  readonly results: ILayerResults;
  readonly deviationsApplied: readonly string[];
}

export interface IRecord {
  readonly path: string;
  readonly report: IConformanceReport;
}

export function notRunResults(): ILayerResults {
  return {
    pinnedCopyIdentity: RESULT_NOT_RUN,
    publishedDocumentComparison: RESULT_NOT_RUN,
    answerValidation: RESULT_NOT_RUN,
    conformanceKit: RESULT_NOT_RUN,
  };
}

export function buildReport(facts: IReportFacts): IConformanceReport {
  return {
    api: facts.api,
    openapiVersion: facts.openapiVersion,
    date: facts.date.toISOString(),
    results: facts.results,
    deviationsApplied: [...facts.deviationsApplied],
  };
}

/** CNF-07: one API uses conformance-report.json, a module with several uses conformance-report.<api>.json. */
export function reportPathOf(moduleDirectory: string, api: string, severalApisInModule: boolean): string {
  return join(moduleDirectory, severalApisInModule ? `conformance-report.${api.toLowerCase()}.json` : REPORT_FILE);
}

/** Validates and writes the report. Answers whether it was written, and says why when it was not. */
export async function recordRun(files: IFiles, record: IRecord, log: (message: string) => void): Promise<boolean> {
  try {
    const text = JSON.stringify(ConformanceReportSchema.parse(record.report), null, JSON_INDENT);
    await files.writeText(record.path, `${text}\n`);
    return true;
  } catch (error) {
    log(`the conformance report could not be written: ${describeError(error)}`);
    return false;
  }
}
