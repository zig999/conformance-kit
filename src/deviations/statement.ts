import { ConfigurationError } from '../shared/errors.js';

export interface IStatementNames {
  readonly pointers: readonly string[];
  readonly items: readonly string[];
}

const GRAVE_ACCENT = '`';
const QUOTATION_MARK = '"';
const REVERSE_SOLIDUS = '\\';
const PAIR = 2;

interface IGraveSplit {
  readonly prose: string;
  readonly items: readonly string[];
}

function refuse(message: string, node: string, cause?: unknown): never {
  throw new ConfigurationError(message, { node }, cause === undefined ? undefined : { cause });
}

function splitGraveText(statement: string, node: string): IGraveSplit {
  const parts = statement.split(GRAVE_ACCENT);
  if (parts.length % PAIR === 0) {
    return refuse(`the statement of ${node} holds a grave accent that no second grave accent closes`, node);
  }
  const items = parts.filter((_, position) => position % PAIR === 1);
  if (items.includes('')) {
    return refuse(`the statement of ${node} holds a pair of grave accents with no identifier between them`, node);
  }
  return { prose: parts.filter((_, position) => position % PAIR === 0).join(''), items };
}

function closingQuotationMark(prose: string, open: number, node: string): number {
  for (let at = open + 1; at < prose.length; at += 1) {
    if (prose[at] === REVERSE_SOLIDUS) {
      at += 1;
    } else if (prose[at] === QUOTATION_MARK) {
      return at;
    }
  }
  return refuse(`the statement of ${node} holds a quotation mark that no second quotation mark closes`, node);
}

function valueOfJsonString(literal: string, node: string): string {
  try {
    const value: unknown = JSON.parse(literal);
    if (typeof value === 'string') {
      return value;
    }
  } catch (cause) {
    return refuse(`the statement of ${node} quotes a text that is not a JSON string`, node, cause);
  }
  return refuse(`the statement of ${node} quotes a text that is not a JSON string`, node);
}

function quotedValues(prose: string, node: string): string[] {
  const values: string[] = [];
  for (let open = prose.indexOf(QUOTATION_MARK); open >= 0;) {
    const close = closingQuotationMark(prose, open, node);
    values.push(valueOfJsonString(prose.slice(open, close + 1), node));
    open = prose.indexOf(QUOTATION_MARK, close + 1);
  }
  return values;
}

/** JSON pointers are the double-quoted JSON strings; CTK item identifiers are the texts between grave accents (CNF-06). */
export function namesOf(statement: string, node: string): IStatementNames {
  const { prose, items } = splitGraveText(statement, node);
  return { pointers: [...new Set(quotedValues(prose, node))], items: [...new Set(items)] };
}
