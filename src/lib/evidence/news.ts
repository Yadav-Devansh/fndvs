/**
 * News corroboration via GDELT DOC 2.0 (no key). Fail-soft: any problem returns
 * status "error" and the verdict simply ignores news. Titles only — no article
 * bodies are fetched and no sites are scraped.
 */
import { tokenize } from "../detect/tokenize";
import { isReputable, normaliseDomain } from "./outlets";
import type { NewsArticle, NewsLookup } from "./types";

const STOPWORDS = new Set(
  (
    "a an the and or but if then than that this these those is are was were be been being to of in on at by for " +
    "with from as into about over after before under above it its they them their there here he she his her we our " +
    "you your i me my has have had do does did will would shall should can could may might must not no nor so very " +
    "just also only all any each every some such more most other new said says say according per via who whom whose " +
    "which what when where why how up down out off again further once now today tomorrow yesterday next last week month " +
    "year years share forward urgent breaking viral claim claims claimed people news report reports"
  ).split(" "),
);

/** 4-6 distinctive terms, in order of first appearance. Deterministic. */
export function keyTermsFor(text: string): string[] {
  const out: string[] = [];
  for (const t of tokenize(text)) {
    if (t.length < 4 || STOPWORDS.has(t) || /^\d+$/.test(t) || out.includes(t)) continue;
    out.push(t);
    if (out.length === 6) break;
  }
  return out;
}

const BREAKING = /\b(breaking|today|tonight|right now|just now|urgent|this morning|this evening|hours ago)\b/i;

/** Breaking claims only count recent coverage. */
export function windowDaysFor(text: string): number {
  return BREAKING.test(text) ? 7 : 90;
}

export function titleMatchRatio(title: string, keyTerms: string[]): number {
  if (!keyTerms.length) return 0;
  const tokens = new Set(tokenize(title));
  return keyTerms.filter((k) => tokens.has(k)).length / keyTerms.length;
}

/** Distinct allow-listed domains whose titles share >= 60% of the key terms. */
export function corroboratingDomains(articles: NewsArticle[]): string[] {
  const out: string[] = [];
  for (const a of articles) {
    if (a.reputable && a.matchRatio >= 0.6 && !out.includes(a.domain)) out.push(a.domain);
  }
  return out;
}

interface GdeltArticle {
  url?: string;
  title?: string;
  domain?: string;
  seendate?: string;
}

function parseSeen(s: string | undefined): string | null {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

export async function lookupNews(text: string): Promise<NewsLookup> {
  const keyTerms = keyTermsFor(text);
  const windowDays = windowDaysFor(text);
  const base = { provider: "GDELT DOC 2.0" as const, windowDays, keyTerms, articles: [], corroboratingDomains: [], corroborated: false };
  if (keyTerms.length < 4) {
    return { ...base, status: "skipped", message: "Not enough distinctive words to search news coverage." };
  }

  const query = `${keyTerms.join(" ")} sourcelang:english`;
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&maxrecords=75" +
    `&timespan=${windowDays}d&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ...base, status: "error", message: "News search is unavailable right now." };
    const body = await res.text();
    let data: { articles?: GdeltArticle[] };
    try {
      data = JSON.parse(body) as { articles?: GdeltArticle[] };
    } catch {
      // GDELT answers rate limits and query errors with plain text.
      return { ...base, status: "error", message: "News search is busy right now." };
    }

    const seen = new Set<string>();
    const articles: NewsArticle[] = [];
    for (const a of data.articles ?? []) {
      if (!a.url || !a.title || !a.domain) continue;
      const domain = normaliseDomain(a.domain);
      if (seen.has(domain)) continue; // one article per domain
      seen.add(domain);
      articles.push({
        id: "",
        title: a.title.slice(0, 300),
        url: a.url,
        domain,
        seenAt: parseSeen(a.seendate),
        reputable: isReputable(domain),
        matchRatio: Math.round(titleMatchRatio(a.title, keyTerms) * 100) / 100,
      });
    }
    // Most relevant first: reputable, then match ratio. Stable for ties.
    articles.sort((x, y) => Number(y.reputable) - Number(x.reputable) || y.matchRatio - x.matchRatio);
    const top = articles.slice(0, 8).map((a, i) => ({ ...a, id: `N${i + 1}` }));
    const domains = corroboratingDomains(top);
    return { ...base, status: "ok", articles: top, corroboratingDomains: domains, corroborated: domains.length >= 2 };
  } catch {
    return { ...base, status: "error", message: "News search timed out." };
  }
}
