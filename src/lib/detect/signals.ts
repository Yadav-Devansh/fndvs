/** Pure signal extractors. Each takes tokens (and sometimes raw text). */
import {
  ATTRIBUTION_VERBS,
  DEBUNK_MARKERS,
  DEBUNK_SUPPRESSED,
  MONTHS,
  NAMED_BODIES,
  SENSATIONAL_TERMS,
} from "./lexicon";
import { findTerms, hasPhrase, phraseIndices, tokenize, upperTokens } from "./tokenize";

export type Language = "english" | "non-english";

/** Non-Latin script or a low share of ASCII letters means we can't read it. */
export function detectLanguage(raw: string): Language {
  const letters = raw.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return "non-english";
  const ascii = letters.filter((c) => /[A-Za-z]/.test(c)).length;
  return ascii / letters.length >= 0.8 ? "english" : "non-english";
}

export function detectDebunk(tokens: string[]): boolean {
  if (DEBUNK_MARKERS.some((m) => hasPhrase(tokens, m))) return true;
  const rumour = hasPhrase(tokens, "rumour") || hasPhrase(tokens, "rumours") || hasPhrase(tokens, "rumor");
  return rumour && hasPhrase(tokens, "false");
}

export function sensationalHits(tokens: string[], debunkFraming: boolean) {
  return Object.entries(SENSATIONAL_TERMS)
    .filter(([term]) => !(debunkFraming && DEBUNK_SUPPRESSED.includes(term)))
    .filter(([term]) => hasPhrase(tokens, term))
    .map(([term, weight]) => ({ term, weight }));
}

const isDay = (t: string | undefined) => !!t && /^\d{1,2}$/.test(t) && +t >= 1 && +t <= 31;
const isYear = (t: string | undefined) => !!t && /^(19|20)\d{2}$/.test(t);
const ordinal = (t: string | undefined) => t?.replace(/(st|nd|rd|th)$/, "");

/** Dates: a month name only counts next to a day number or a 4-digit year. */
export function findDates(tokens: string[]): string[] {
  const out: string[] = [];
  const used = new Set<number>();
  tokens.forEach((t, i) => {
    if (!MONTHS.includes(t)) return;
    const prev = ordinal(tokens[i - 1]);
    const next = ordinal(tokens[i + 1]);
    const parts: string[] = [];
    if (isDay(prev)) { parts.push(tokens[i - 1]!); used.add(i - 1); }
    parts.push(t);
    if (isDay(next) || isYear(next)) {
      parts.push(tokens[i + 1]!);
      used.add(i + 1);
      if (isDay(next) && isYear(tokens[i + 2])) { parts.push(tokens[i + 2]!); used.add(i + 2); }
    }
    if (parts.length > 1) out.push(parts.join(" "));
  });
  tokens.forEach((t, i) => {
    if (!used.has(i) && isYear(t)) out.push(t);
  });
  return out;
}

/** Figures and quantities from the raw text. */
export function findNumbers(raw: string): string[] {
  return (raw.match(/\b\d[\d,.]*\s?(%|percent|crore|lakh|million|billion|kg|km)?/gi) ?? []).map((s) => s.trim());
}

interface BodyHit { name: string; index: number; length: number }

/** Named institutions, longest match first, no overlaps. "WHO" only when uppercase. */
export function findBodies(tokens: string[], raw: string): BodyHit[] {
  const used = new Set<number>();
  const hits: BodyHit[] = [];
  const bodies = [...NAMED_BODIES].sort((a, b) => tokenize(b).length - tokenize(a).length);
  for (const name of bodies) {
    const length = tokenize(name).length;
    for (const index of phraseIndices(tokens, name)) {
      const span = Array.from({ length }, (_, k) => index + k);
      if (span.some((k) => used.has(k))) continue;
      span.forEach((k) => used.add(k));
      hits.push({ name, index, length });
    }
  }
  if (upperTokens(raw).has("WHO")) {
    tokens.forEach((t, index) => {
      if (t === "who" && !used.has(index)) hits.push({ name: "WHO", index, length: 1 });
    });
  }
  return hits.sort((a, b) => a.index - b.index);
}

/**
 * Claimed attribution: "<body> said/announced/…" or "according to / as per <body>".
 * Never evidence of truth — only a pointer to where the claim should be checked.
 */
export function findAttribution(tokens: string[], bodies: BodyHit[]): string[] {
  const out = new Set<string>();
  for (const b of bodies) {
    const after = tokens.slice(b.index + b.length, b.index + b.length + 3);
    const verb = after.find((t) => ATTRIBUTION_VERBS.includes(t));
    if (verb) out.add(`${b.name} ${verb}`);
    const before = tokens.slice(Math.max(0, b.index - 5), b.index).join(" ");
    if (/\baccording to\b/.test(before)) out.add(`according to ${b.name}`);
    else if (/\bas per\b/.test(before)) out.add(`as per ${b.name}`);
  }
  return [...out];
}

export { findTerms };
