const WHITE_SPACE_RUN = /\s+/g;

/**
 * The identifier of a CTK item: the title as the kit reports it, with every run of white space made one space and
 * the ends trimmed. The real titles hold line breaks and tabs, which a one-line deviation node cannot spell, so the
 * report and the deviation are both compared in this form.
 */
export function normalizeIdentifier(text: string): string {
  return text.replace(WHITE_SPACE_RUN, ' ').trim();
}
