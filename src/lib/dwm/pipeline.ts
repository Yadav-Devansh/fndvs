/**
 * Shared ETL pipeline for large headline datasets. Used by the browser Web
 * Worker AND the offline Bun script so both produce identical aggregates.
 * Memory is bounded: only cube cells, keyword counters (pruned), a 32-bit
 * duplicate hash set and a per-year reservoir sample are kept.
 */

import { predict } from "../predict";
import { ASPECT_IDS, type AspectId } from "./etl";
import {
  SCORER_VERSION,
  type CubeCell,
  type DroppedCounts,
  type DwmAggregates,
  type KeywordStat,
  type ScoredHeadline,
} from "./types";

// ---------------------------------------------------------------- cleaning

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
};

export function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** FNV-1a 32-bit hash for bounded-memory duplicate detection. */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- categories

const CATEGORY_MAP: Record<string, string> = {
  india: "India", city: "City", sports: "Sports", sport: "Sports", business: "Business",
  entertainment: "Entertainment", "tv": "Entertainment", world: "World", tech: "Tech",
  technology: "Tech", gadgets: "Tech", education: "Education", life: "Lifestyle",
  lifestyle: "Lifestyle", "life-style": "Lifestyle", home: "India", nation: "India",
  national: "India", politics: "India", astrology: "Lifestyle", spirituality: "Lifestyle",
};
export const KNOWN_CATEGORIES = [
  "India", "City", "Sports", "Business", "Entertainment", "World", "Tech", "Education", "Lifestyle", "Other",
];

export function normaliseCategory(raw: string): string {
  const first = (raw ?? "").trim().toLowerCase().split(".")[0] ?? "";
  if (!first || first === "unknown") return "Other";
  return CATEGORY_MAP[first] ?? "Other";
}

// ---------------------------------------------------------------- dates

export type DateFormat =
  | "YYYYMMDD" | "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD-MM-YYYY"
  | "MONTH DD, YYYY" | "EXCEL" | "UNIX" | "AUTO";

export const DATE_FORMATS: DateFormat[] = [
  "AUTO", "YYYYMMDD", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "MONTH DD, YYYY", "EXCEL", "UNIX",
];

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Returns an integer yyyymmdd or null. */
function ymd(y: number, m: number, d: number): number | null {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return y * 10000 + m * 100 + d;
}

export function parseDate(v: string, fmt: DateFormat): number | null {
  const s = (v ?? "").trim().replace(/^"|"$/g, "");
  if (!s) return null;
  let m: RegExpMatchArray | null;
  switch (fmt) {
    case "YYYYMMDD":
      m = s.match(/^(\d{4})(\d{2})(\d{2})/);
      return m ? ymd(+m[1]!, +m[2]!, +m[3]!) : null;
    case "YYYY-MM-DD":
      m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      return m ? ymd(+m[1]!, +m[2]!, +m[3]!) : null;
    case "DD/MM/YYYY":
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      return m ? ymd(+m[3]!, +m[2]!, +m[1]!) : null;
    case "MM/DD/YYYY":
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      return m ? ymd(+m[3]!, +m[1]!, +m[2]!) : null;
    case "DD-MM-YYYY":
      m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
      return m ? ymd(+m[3]!, +m[2]!, +m[1]!) : null;
    case "MONTH DD, YYYY": {
      m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
      if (!m) return null;
      const mi = MONTH_NAMES.indexOf(m[1]!.slice(0, 3).toLowerCase());
      return mi < 0 ? null : ymd(+m[3]!, mi + 1, +m[2]!);
    }
    case "EXCEL": {
      const n = Number(s);
      if (!Number.isFinite(n) || n < 1000 || n > 80000) return null;
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    case "UNIX": {
      let n = Number(s);
      if (!Number.isFinite(n) || n < 1e8) return null;
      if (n > 1e11) n = n / 1000;
      const d = new Date(n * 1000);
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    case "AUTO":
      return null;
  }
}

/** Pick the format that parses the most of the given sample values. */
export function detectDateFormat(values: string[]): DateFormat {
  const sample = values.filter((v) => v && v.trim()).slice(0, 1000);
  let best: DateFormat = "YYYY-MM-DD";
  let bestHits = -1;
  for (const f of DATE_FORMATS) {
    if (f === "AUTO") continue;
    let hits = 0;
    for (const v of sample) if (parseDate(v, f) !== null) hits++;
    if (hits > bestHits) { bestHits = hits; best = f; }
  }
  return best;
}

export function ymdToIso(n: number): string {
  const s = String(n);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Window start = maxDate minus N years (same month/day). */
export function windowStartFor(maxYmd: number, years: number): number {
  return maxYmd - years * 10000 + 1;
}

// ---------------------------------------------------------------- CSV parsing

/** Incremental CSV/TSV parser. Feed text chunks; it emits complete records. */
export class DelimitedParser {
  private buf = "";
  constructor(public delimiter: string) {}

  push(chunk: string, onRow: (cells: string[]) => void, final = false) {
    this.buf += chunk;
    let start = 0;
    let row: string[] = [];
    let field = "";
    let inQ = false;
    let i = 0;
    const b = this.buf;
    const d = this.delimiter;
    let rowStart = 0;
    for (; i < b.length; i++) {
      const c = b[i]!;
      if (inQ) {
        if (c === '"') {
          if (b[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += c;
        continue;
      }
      if (c === '"' && field === "") inQ = true;
      else if (c === d) { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && b[i + 1] === "\n") i++;
        row.push(field);
        onRow(row);
        row = []; field = ""; rowStart = i + 1;
      } else field += c;
    }
    start = rowStart;
    if (final) {
      if (field !== "" || row.length) { row.push(field); onRow(row); }
      this.buf = "";
    } else {
      this.buf = b.slice(start);
    }
  }
}

export function detectDelimiter(headerLine: string): string {
  const cands = [",", "\t", ";", "|"];
  let best = ",";
  let n = -1;
  for (const c of cands) {
    const k = headerLine.split(c).length;
    if (k > n) { n = k; best = c; }
  }
  return best;
}

const GUESS: Record<string, string[]> = {
  date: ["publish_date", "date", "published", "pub_date", "created_at", "time"],
  category: ["headline_category", "category", "topic", "section", "subject"],
  text: ["headline_text", "headline", "statement", "text", "title", "content", "news"],
  label: ["label", "class", "verdict", "is_fake", "target"],
};

export function guessColumn(headers: string[], kind: keyof typeof GUESS): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of GUESS[kind] ?? []) {
    const i = lower.indexOf(name);
    if (i >= 0) return i;
  }
  for (const name of GUESS[kind] ?? []) {
    const i = lower.findIndex((h) => h.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- keywords

const STOP = new Set(
  ("the a an and or but of to in on for with at by from that this it is are was were be been as has have had will would " +
    "not no its their they he she we you said says after over new more than up out into about how why what who when " +
    "can may all his her our your one two three first last day year years s t vs amid get gets now just here").split(" "),
);

export function keywordsOf(text: string, max = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
    if (w.length < 4 || STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

class KeywordCounter {
  private m = new Map<string, { c: number; r: number }>();
  constructor(private cap = 40000) {}
  add(w: string, risk: boolean) {
    const e = this.m.get(w);
    if (e) { e.c++; if (risk) e.r++; }
    else {
      this.m.set(w, { c: 1, r: risk ? 1 : 0 });
      if (this.m.size > this.cap) this.prune();
    }
  }
  private prune() {
    // Drop singletons (bounded memory; affects only very rare words).
    for (const [k, v] of this.m) if (v.c <= 1) this.m.delete(k);
    if (this.m.size > this.cap * 0.8) {
      const keep = [...this.m.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, Math.floor(this.cap / 2));
      this.m = new Map(keep);
    }
  }
  top(n: number): KeywordStat[] {
    return [...this.m.entries()]
      .sort((a, b) => b[1].c - a[1].c)
      .slice(0, n)
      .map(([word, v]) => ({ word, count: v.c, risk: v.r }));
  }
}

// ---------------------------------------------------------------- scoring

export function scoreHeadline(text: string) {
  const r = predict(text);
  const scores = {} as Record<AspectId, number>;
  for (const id of ASPECT_IDS) scores[id] = 50;
  for (const a of r.aspects) if ((ASPECT_IDS as readonly string[]).includes(a.id)) scores[a.id as AspectId] = a.score;
  return { verdict: (r.label === "FAKE" ? 0 : 1) as 0 | 1, confidence: r.confidenceScore, scores };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- aggregation

export interface AggregatorOptions {
  datasetId: string;
  datasetName: string;
  source: string;
  isSynthetic: boolean;
  windowStartYmd: number;
  windowEndYmd: number;
  windowYears: number;
  sampleSize: number;
  /** When set, only this fraction of in-window rows is scored (random, seeded). */
  scoreFraction?: number;
  processingMode: string;
}

const zeroAspects = () => {
  const o = {} as Record<AspectId, number>;
  for (const id of ASPECT_IDS) o[id] = 0;
  return o;
};

export class Aggregator {
  readonly dropped: DroppedCounts = { empty: 0, duplicate: 0, badDate: 0, outOfWindow: 0, other: 0 };
  rowsRead = 0;
  rowsKept = 0;
  rowsScored = 0;
  currentYear = 0;
  private hashes = new Set<number>();
  private cube = new Map<string, CubeCell>();
  private kwYear = new Map<number, KeywordCounter>();
  private kwCat = new Map<string, KeywordCounter>();
  private reservoirs = new Map<number, { seen: number; rows: ScoredHeadline[] }>();
  private rand = rng(42);
  private nextId = 0;

  constructor(private o: AggregatorOptions) {}

  /** Returns true when the row was scored. */
  add(rawDate: number | null, rawCategory: string, rawText: string): boolean {
    this.rowsRead++;
    const text = cleanText(rawText ?? "");
    if (!text || text.split(" ").length < 3) { this.dropped.empty++; return false; }
    if (rawDate === null) { this.dropped.badDate++; return false; }
    if (rawDate < this.o.windowStartYmd || rawDate > this.o.windowEndYmd) { this.dropped.outOfWindow++; return false; }
    const h = hash32(text.toLowerCase());
    if (this.hashes.has(h)) { this.dropped.duplicate++; return false; }
    this.hashes.add(h);
    this.rowsKept++;
    if (this.o.scoreFraction !== undefined && this.rand() > this.o.scoreFraction) return false;

    const year = Math.floor(rawDate / 10000);
    const month = Math.floor(rawDate / 100) % 100;
    this.currentYear = year;
    const category = normaliseCategory(rawCategory);
    let s;
    try { s = scoreHeadline(text); } catch { this.dropped.other++; return false; }
    this.rowsScored++;
    const risk = s.verdict === 0;

    const key = `${year}|${month}|${category}`;
    let cell = this.cube.get(key);
    if (!cell) {
      cell = { year, month, category, total: 0, risk: 0, confSum: 0, lowConf: 0, aspectSum: zeroAspects(), aspectFail: zeroAspects() };
      this.cube.set(key, cell);
    }
    cell.total++;
    if (risk) cell.risk++;
    cell.confSum += s.confidence;
    if (s.confidence < 60) cell.lowConf++;
    for (const id of ASPECT_IDS) {
      cell.aspectSum[id] += s.scores[id];
      if (s.scores[id] < 50) cell.aspectFail[id]++;
    }

    const kws = keywordsOf(text);
    let ky = this.kwYear.get(year);
    if (!ky) { ky = new KeywordCounter(); this.kwYear.set(year, ky); }
    let kc = this.kwCat.get(category);
    if (!kc) { kc = new KeywordCounter(); this.kwCat.set(category, kc); }
    for (const w of kws) { ky.add(w, risk); kc.add(w, risk); }

    // Stratified reservoir sample: equal slot budget per year.
    const perYear = Math.max(1, Math.floor(this.o.sampleSize / Math.max(1, this.o.windowYears + 1)));
    let res = this.reservoirs.get(year);
    if (!res) { res = { seen: 0, rows: [] }; this.reservoirs.set(year, res); }
    res.seen++;
    const row: ScoredHeadline = {
      id: this.nextId++, date: ymdToIso(rawDate), year, month, category, text,
      verdict: s.verdict, confidence: s.confidence, scores: s.scores, keywords: kws,
    };
    if (res.rows.length < perYear) res.rows.push(row);
    else {
      const j = Math.floor(this.rand() * res.seen);
      if (j < perYear) res.rows[j] = row;
    }
    return true;
  }

  finalize(): DwmAggregates {
    // Merge categories below 0.5% of rows into Other.
    const catTotals = new Map<string, number>();
    for (const c of this.cube.values()) catTotals.set(c.category, (catTotals.get(c.category) ?? 0) + c.total);
    const rare = new Set([...catTotals].filter(([, n]) => n < this.rowsScored * 0.005).map(([k]) => k));
    const merged = new Map<string, CubeCell>();
    for (const c of this.cube.values()) {
      const category = rare.has(c.category) ? "Other" : c.category;
      const key = `${c.year}|${c.month}|${category}`;
      const m = merged.get(key);
      if (!m) { merged.set(key, { ...c, category, aspectSum: { ...c.aspectSum }, aspectFail: { ...c.aspectFail } }); continue; }
      m.total += c.total; m.risk += c.risk; m.confSum += c.confSum; m.lowConf += c.lowConf;
      for (const id of ASPECT_IDS) { m.aspectSum[id] += c.aspectSum[id]; m.aspectFail[id] += c.aspectFail[id]; }
    }
    const round = (n: number) => Math.round(n * 10) / 10;
    const cube = [...merged.values()]
      .map((c) => {
        const aspectSum = zeroAspects();
        for (const id of ASPECT_IDS) aspectSum[id] = round(c.aspectSum[id]);
        return { ...c, confSum: round(c.confSum), aspectSum };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month || a.category.localeCompare(b.category));

    const keywordsByYear: Record<string, KeywordStat[]> = {};
    for (const [y, k] of [...this.kwYear].sort((a, b) => a[0] - b[0])) keywordsByYear[String(y)] = k.top(200);
    const keywordsByCategory: Record<string, KeywordStat[]> = {};
    for (const [c, k] of this.kwCat) {
      const name = rare.has(c) ? "Other" : c;
      if (!keywordsByCategory[name]) keywordsByCategory[name] = k.top(100);
    }
    const sample = [...this.reservoirs.values()]
      .flatMap((r) => r.rows)
      .map((r) => (rare.has(r.category) ? { ...r, category: "Other" } : r))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      meta: {
        datasetId: this.o.datasetId,
        datasetName: this.o.datasetName,
        source: this.o.source,
        isSynthetic: this.o.isSynthetic,
        windowStart: ymdToIso(this.o.windowStartYmd),
        windowEnd: ymdToIso(this.o.windowEndYmd),
        windowYears: this.o.windowYears,
        rowsRead: this.rowsRead,
        rowsKept: this.rowsKept,
        rowsScored: this.rowsScored,
        dropped: { ...this.dropped },
        builtAt: new Date().toISOString(),
        scorerVersion: SCORER_VERSION,
        processingMode: this.o.processingMode,
      },
      cube,
      keywordsByYear,
      keywordsByCategory,
      sample,
    };
  }
}

export const TOI_SOURCE = {
  datasetId: "toi-headlines",
  datasetName: "Times of India News Headlines",
  source: "Kulkarni, R. (2020), Harvard Dataverse, doi:10.7910/DVN/DPQMQH (also Hugging Face community-datasets/times_of_india_news_headlines), CC0",
};
