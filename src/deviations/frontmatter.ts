import { join } from 'node:path';
import { ConfigurationError } from '../shared/errors.js';
import type { IFiles } from '../shared/ports.js';

const FRONTMATTER_FENCE = '---';
const STATEMENT_KEY = 'statement:';
const EXCLUDES_KEY = 'excludes:';
const BLOCK_SCALAR = /^[>|][+-]?[0-9]?$/;
const LITERAL_BLOCK_MARK = '|';
const UNSUPPORTED_SCALAR_START = /^["'[{]/;
const BLOCK_LIST_ITEM = /^-(\s|$)/;
const INDENTED = /^\s/;
const SEQUENCE_ITEM_MARK = '-';
const EXCLUDED_NODE_LINE = /^\s*(?:-\s+)?node:\s*(.*?)\s*$/;
const QUOTED_TEXT = /^(["'])(.*)\1$/;
const QUOTED_CONTENT_GROUP = 2;
const LINE_BREAK = /\r?\n/;
const NODE_FILE_SUFFIX = '.md';

function refuse(message: string, node: string): never {
  throw new ConfigurationError(message, { node });
}

function frontmatterOf(text: string, node: string): string[] {
  const lines = text.split(LINE_BREAK);
  const close = lines.indexOf(FRONTMATTER_FENCE, 1);
  if (lines[0] !== FRONTMATTER_FENCE || close < 0) {
    return refuse(`the node ${node} holds no frontmatter between two ${FRONTMATTER_FENCE} lines`, node);
  }
  return lines.slice(1, close);
}

export async function readFrontmatter(files: IFiles, specificationRoot: string, node: string): Promise<string[]> {
  const path = join(specificationRoot, `${node}${NODE_FILE_SUFFIX}`);
  let text: string;
  try {
    text = await files.readText(path);
  } catch (cause) {
    throw new ConfigurationError(`the node ${node} cannot be read from the specification`, { node }, { cause });
  }
  return frontmatterOf(text, node);
}

function blockAfter(lines: readonly string[], start: number, endsAt: (line: string) => boolean): string[] {
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() !== '' && endsAt(line));
  return end < 0 ? rest : rest.slice(0, end);
}

function statementLines(frontmatter: readonly string[], start: number): string[] {
  return blockAfter(frontmatter, start, (line) => !INDENTED.test(line))
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function refuseUnsupportedScalar(first: string, continuation: readonly string[], node: string): void {
  const isBlockList = first === '' && BLOCK_LIST_ITEM.test(continuation[0] ?? '');
  if (UNSUPPORTED_SCALAR_START.test(first) || isBlockList) {
    refuse(`the statement of ${node} is a quoted scalar, a list or a map, which this reader does not read`, node);
  }
}

/** The statement as a plain scalar or a block scalar (> or |); anything else is refused. */
export function statementOf(frontmatter: readonly string[], node: string): string {
  const start = frontmatter.findIndex((line) => line.startsWith(STATEMENT_KEY));
  const first = (frontmatter[start] ?? '').slice(STATEMENT_KEY.length).trim();
  const continuation = start < 0 ? [] : statementLines(frontmatter, start);
  refuseUnsupportedScalar(first, continuation, node);
  const joiner = first.startsWith(LITERAL_BLOCK_MARK) ? '\n' : ' ';
  const statement = BLOCK_SCALAR.test(first) ? continuation.join(joiner) : [first, ...continuation].join(' ').trim();
  return statement === '' ? refuse(`the node ${node} holds no statement`, node) : statement;
}

function unquoted(value: string): string {
  return QUOTED_TEXT.exec(value)?.[QUOTED_CONTENT_GROUP] ?? value;
}

export function excludedNodesOf(frontmatter: readonly string[]): string[] {
  const start = frontmatter.findIndex((line) => line.trimEnd() === EXCLUDES_KEY);
  if (start < 0) {
    return [];
  }
  const block = blockAfter(frontmatter, start, (line) => !INDENTED.test(line) && !line.startsWith(SEQUENCE_ITEM_MARK));
  return block.flatMap((line) => {
    const named = EXCLUDED_NODE_LINE.exec(line)?.[1];
    return named === undefined ? [] : [unquoted(named)];
  });
}
