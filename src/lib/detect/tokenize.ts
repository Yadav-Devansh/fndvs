/**
 * Word-boundary tokenisation. Every lexicon lookup goes through these helpers so
 * "whole" never matches "who", "database" never matches "data", and so on.
 */

/** Lowercase word tokens. Hyphens split words ("fact-check" -> fact, check). */
export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []
  );
}

/** Index of every place `phrase` occurs as a whole-token sequence. */
export function phraseIndices(tokens: string[], phrase: string): number[] {
  const parts = tokenize(phrase);
  if (parts.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < parts.length; j++) {
      if (tokens[i + j] !== parts[j]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

export function hasPhrase(tokens: string[], phrase: string): boolean {
  return phraseIndices(tokens, phrase).length > 0;
}

/** Terms from `list` present in `tokens` (each term reported once). */
export function findTerms(tokens: string[], list: readonly string[]): string[] {
  return list.filter((t) => hasPhrase(tokens, t));
}

/** Uppercase-only tokens in the original text, e.g. "WHO". */
export function upperTokens(raw: string): Set<string> {
  return new Set(raw.match(/\b[A-Z]{2,}\b/g) ?? []);
}
