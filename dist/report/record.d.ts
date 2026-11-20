import { z } from 'zod';
import type { IFiles } from '../shared/ports.js';
export declare const RESULT_PASSED = "passed";
export declare const RESULT_FAILED = "failed";
export declare const RESULT_NOT_RUN = "not-run";
export declare const RESULT_NOT_APPLICABLE = "not-applicable";
declare const ResultSchema: z.ZodEnum<{
    failed: "failed";
    "not-run": "not-run";
    passed: "passed";
}>;
/** An API with no kit in tmforum has no layer 4: only `conformanceKit` may say so. */
declare const KitResultSchema: z.ZodEnum<{
    failed: "failed";
    "not-applicable": "not-applicable";
    "not-run": "not-run";
    passed: "passed";
}>;
/** CNF-07: strict, so that an unknown key is refused. */
export declare const ConformanceReportSchema: z.ZodObject<{
    api: z.ZodString;
    openapiVersion: z.ZodString;
    date: z.ZodISODateTime;
    results: z.ZodObject<{
        pinnedCopyIdentity: z.ZodEnum<{
            failed: "failed";
            "not-run": "not-run";
            passed: "passed";
        }>;
        publishedDocumentComparison: z.ZodEnum<{
            failed: "failed";
            "not-run": "not-run";
            passed: "passed";
        }>;
        answerValidation: z.ZodEnum<{
            failed: "failed";
            "not-run": "not-run";
            passed: "passed";
        }>;
        conformanceKit: z.ZodEnum<{
            failed: "failed";
            "not-applicable": "not-applicable";
            "not-run": "not-run";
            passed: "passed";
        }>;
    }, z.core.$strict>;
    deviationsApplied: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
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
export declare function notRunResults(): ILayerResults;
export declare function buildReport(facts: IReportFacts): IConformanceReport;
/** CNF-07: one API uses conformance-report.json, a module with several uses conformance-report.<api>.json. */
export declare function reportPathOf(moduleDirectory: string, api: string, severalApisInModule: boolean): string;
/** Validates and writes the report. Answers whether it was written, and says why when it was not. */
export declare function recordRun(files: IFiles, record: IRecord, log: (message: string) => void): Promise<boolean>;
export {};
