import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ConformanceReportSchema,
  type ILayerResults,
  type KitResult,
  type LayerResult,
} from '../../src/report/record.js';
import { apiCodeOfFile, type IModuleFolder } from './modules.js';

export type Layers = readonly [LayerResult, LayerResult, LayerResult, KitResult];
export type Outcome = 'approved' | 'rejected' | 'incomplete';

export type IMatrixRow =
  | { readonly module: string; readonly kind: 'none' }
  | { readonly module: string; readonly kind: 'invalid'; readonly api: string | undefined; readonly reason: string }
  | {
      readonly module: string;
      readonly kind: 'report';
      readonly api: string;
      readonly version: string;
      readonly layers: Layers;
      readonly deviations: number;
      readonly date: string;
      readonly outcome: Outcome;
    };

/**
 * The report holds no exit code, so the outcome is derived from the layers: rejected as soon as one failed,
 * incomplete when none failed and one did not run, approved when layers 1 to 3 passed and layer 4 passed or does not apply.
 */
export function resultOf(layers: Layers): Outcome {
  if (layers.includes('failed')) {
    return 'rejected';
  }
  return layers.includes('not-run') ? 'incomplete' : 'approved';
}

function layersOf(results: ILayerResults): Layers {
  return [
    results.pinnedCopyIdentity,
    results.publishedDocumentComparison,
    results.answerValidation,
    results.conformanceKit,
  ];
}

function parseJson(text: string): { readonly value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
}

/** Only the places and the names of what is wrong, never a value of the report. */
function problemsOf(error: {
  readonly issues: readonly {
    readonly path: readonly PropertyKey[];
    readonly code: string;
    readonly keys?: readonly string[];
  }[];
}): string {
  const named = error.issues.flatMap((issue) => {
    const place = issue.path.map(String).join('.');
    return issue.code === 'unrecognized_keys'
      ? (issue.keys ?? []).map((key) => [place, key].filter(Boolean).join('.'))
      : [place || '(raiz)'];
  });
  return `campos inválidos: ${[...new Set(named)].join(', ')}`;
}

function rowOfText(module: string, file: string, text: string): IMatrixRow {
  const codeOfFile = apiCodeOfFile(file);
  const invalid = (reason: string, api = codeOfFile): IMatrixRow => ({ module, kind: 'invalid', api, reason });
  const parsed = parseJson(text);
  if (parsed === undefined) {
    return invalid('o arquivo não é JSON');
  }
  const report = ConformanceReportSchema.safeParse(parsed.value);
  if (!report.success) {
    return invalid(problemsOf(report.error));
  }
  const { data } = report;
  if (codeOfFile !== undefined && codeOfFile !== data.api.toUpperCase()) {
    return invalid('o nome do arquivo não casa com a API do relatório', codeOfFile);
  }
  const layers = layersOf(data.results);
  return {
    module,
    kind: 'report',
    api: data.api,
    version: data.openapiVersion,
    layers,
    deviations: data.deviationsApplied.length,
    date: data.date,
    outcome: resultOf(layers),
  };
}

async function rowOfFile(root: string, module: string, file: string): Promise<IMatrixRow> {
  try {
    return rowOfText(module, file, await readFile(join(root, module, 'backend', file), 'utf8'));
  } catch {
    return { module, kind: 'invalid', api: apiCodeOfFile(file), reason: 'o arquivo não pôde ser lido' };
  }
}

function apiOf(row: IMatrixRow): string {
  return row.kind === 'none' ? '' : (row.api ?? '');
}

/** One row per report file of the module, or one row saying it has none. */
export async function rowsOfModule(root: string, module: IModuleFolder): Promise<IMatrixRow[]> {
  if (module.reportFiles.length === 0) {
    return [{ module: module.name, kind: 'none' }];
  }
  const rows = await Promise.all(module.reportFiles.map((file) => rowOfFile(root, module.name, file)));
  return rows.toSorted((first, second) => apiOf(first).localeCompare(apiOf(second)));
}
