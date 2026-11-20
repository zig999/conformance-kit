import type { Outcome, IMatrixRow } from './rows.js';

const DASH = '—';
const HEADER = '| Módulo | API | Versão | Camada 1 | Camada 2 | Camada 3 | Camada 4 | Resultado | Desvios | Data |';
const SEPARATOR = '|---|---|---|---|---|---|---|---|---|---|';
const LAYER_WORDS: Readonly<Record<string, string>> = {
  passed: 'passou',
  failed: 'falhou',
  'not-run': 'não rodou',
  'not-applicable': 'não se aplica',
};
const OUTCOME_WORDS: Readonly<Record<Outcome, string>> = {
  approved: 'aprovada',
  rejected: 'reprovada',
  incomplete: 'incompleta',
};

const MARKDOWN_SPECIALS = /[\\|`*_<>[\]#]/g;
const WHITE_SPACE_RUN = /\s+/g;
const LONGEST_CELL = 200;

/** What a report or a folder name says is not trusted: one line, no markup, and not longer than a cell should be. */
const cell = (text: string): string => {
  const oneLine = text.replace(WHITE_SPACE_RUN, ' ').trim();
  const short = oneLine.length > LONGEST_CELL ? `${oneLine.slice(0, LONGEST_CELL)}…` : oneLine;
  return short.replace(MARKDOWN_SPECIALS, '\\$&');
};
const line = (cells: readonly string[]): string => `| ${cells.map(cell).join(' | ')} |`;

function rowLine(row: IMatrixRow): string {
  if (row.kind === 'none') {
    return line([row.module, DASH, DASH, DASH, DASH, DASH, DASH, 'sem relatório', DASH, DASH]);
  }
  if (row.kind === 'invalid') {
    return line([row.module, row.api ?? DASH, DASH, DASH, DASH, DASH, DASH, `inválido: ${row.reason}`, DASH, DASH]);
  }
  const layers = row.layers.map((layer) => LAYER_WORDS[layer] ?? layer);
  return line([
    row.module,
    row.api,
    row.version,
    ...layers,
    OUTCOME_WORDS[row.outcome],
    String(row.deviations),
    row.date,
  ]);
}

const LEGEND = [
  '## Como ler',
  '',
  '- **Camadas 1 a 4:** contrato fixado, contrato publicado, comportamento e CTK (CNF-01 a CNF-04). `passou`, `falhou`, `não rodou` (a camada devia ter rodado e não rodou) ou `não se aplica` (só a camada 4, para a API que não tem CTK em `../tmforum`).',
  '- **Resultado:** derivado das camadas do último relatório, porque o relatório não guarda o código de saída. `reprovada` se alguma camada falhou; `incompleta` se nenhuma falhou e alguma não rodou; `aprovada` se as camadas 1 a 3 passaram e a 4 passou ou não se aplica.',
  '- **Desvios:** quantos nós de desvio cobriram uma diferença ou excluíram um item do CTK na última execução (`deviationsApplied`), e não quantos a API tem registrados.',
  '- **Data:** o instante do último `pnpm conformance`, do relatório.',
  '- **`sem relatório`:** o módulo existe e não tem `conformance-report*.json`. **`inválido`:** o relatório não passou no schema estrito do kit.',
  '- Um módulo com mais de uma API que só tem o relatório de uma delas só mostra essa: a matriz não sabe quais APIs faltam.',
];

/** The text of the matrix. The same rows always give the same text: nothing in it depends on the day it is made. */
export function renderMatrix(rows: readonly IMatrixRow[], excluded: readonly string[]): string {
  const intro = [
    '# Matriz de conformidade',
    '',
    'Gerada por `conformance-kit/scripts/generate-matrix.ts` (`pnpm matrix` no conformance-kit) a partir dos `conformance-report*.json` de cada módulo (CNF-07, CNF-08). **Não edite à mão:** a próxima geração a substitui.',
    '',
  ];
  const body = rows.length === 0 ? ['Nenhum módulo encontrado.'] : [HEADER, SEPARATOR, ...rows.map(rowLine)];
  const left =
    excluded.length === 0
      ? []
      : [
          '',
          `Pastas excluídas pelo operador, por não serem módulos do padrão: ${excluded.map((name) => `\`${name}\``).join(', ')}.`,
        ];
  return [...intro, ...body, ...left, '', ...LEGEND, ''].join('\n');
}
