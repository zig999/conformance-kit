import { ConfigurationError } from '../shared/errors.js';
import { normalizeIdentifier } from '../shared/identifier.js';
const GRAVE_ACCENT = '`';
const QUOTATION_MARK = '"';
const REVERSE_SOLIDUS = '\\';
const PAIR = 2;
function refuse(message, node, cause) {
    throw new ConfigurationError(message, { node }, cause === undefined ? undefined : { cause });
}
function splitGraveText(statement, node) {
    const parts = statement.split(GRAVE_ACCENT);
    if (parts.length % PAIR === 0) {
        return refuse(`the statement of ${node} holds a grave accent that no second grave accent closes`, node);
    }
    const items = parts.filter((_, position) => position % PAIR === 1).map(normalizeIdentifier);
    if (items.includes('')) {
        return refuse(`the statement of ${node} holds a pair of grave accents with no identifier between them`, node);
    }
    return { prose: parts.filter((_, position) => position % PAIR === 0).join(''), items };
}
function closingQuotationMark(prose, open, node) {
    for (let at = open + 1; at < prose.length; at += 1) {
        if (prose[at] === REVERSE_SOLIDUS) {
            at += 1;
        }
        else if (prose[at] === QUOTATION_MARK) {
            return at;
        }
    }
    return refuse(`the statement of ${node} holds a quotation mark that no second quotation mark closes`, node);
}
function valueOfJsonString(literal, node) {
    try {
        const value = JSON.parse(literal);
        if (typeof value === 'string') {
            return value;
        }
    }
    catch (cause) {
        return refuse(`the statement of ${node} quotes a text that is not a JSON string`, node, cause);
    }
    return refuse(`the statement of ${node} quotes a text that is not a JSON string`, node);
}
function quotedValues(prose, node) {
    const values = [];
    for (let open = prose.indexOf(QUOTATION_MARK); open >= 0;) {
        const close = closingQuotationMark(prose, open, node);
        values.push(valueOfJsonString(prose.slice(open, close + 1), node));
        open = prose.indexOf(QUOTATION_MARK, close + 1);
    }
    return values;
}
/** JSON pointers are the double-quoted JSON strings; CTK item identifiers are the texts between grave accents (CNF-06). */
export function namesOf(statement, node) {
    const { prose, items } = splitGraveText(statement, node);
    return { pointers: [...new Set(quotedValues(prose, node))], items: [...new Set(items)] };
}
