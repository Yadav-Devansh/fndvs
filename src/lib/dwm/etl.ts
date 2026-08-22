/**
 * DWM Concept: ETL + Data Cleaning + Data Warehouse (Star Schema)
 *
 * Extracts the verification records that FNDVS already stores in the browser,
 * cleans/normalises them, and loads them into an in-memory star schema.
 * Nothing here mutates the source records.
 */

import type { VerificationRecord } from "@/lib/store";

export const ASPECT_IDS = [
  "sensational",
  "attribution",
  "emotion",
  "urgency",
  "specificity",
  "style",
  "clickbait",
  "corroboration",
] as const;

export type AspectId = (typeof ASPECT_IDS)[number];

export const ASPECT_LABELS: Record<AspectId, string> = {
  sensational: "Sensational vocabulary",
  attribution: "Source attribution",
  emotion: "Emotional tone",
  urgency: "Urgency & forwarding",
  specificity: "Factual specificity",
  style: "Writing-style integrity",
  clickbait: "Clickbait framing",
  corroboration: "Official corroboration",
};

export const ASPECT_SHORT: Record<AspectId, string> = {
  sensational: "Sensational",
  attribution: "Source",
  emotion: "Emotion",
  urgency: "Urgency",
  specificity: "Specificity",
  style: "Style",
  clickbait: "Clickbait",
  corroboration: "Corroboration",
};

export type ConfidenceBand = "Strong" | "Moderate" | "Low";

export function bandFor(score: number): ConfidenceBand {
  return score >= 80 ? "Strong" : score >= 60 ? "Moderate" : "Low";
}

export interface DimDate {
  date_id: string;
  date: string;
  day: number;
  month: number;
  monthName: string;
  year: number;
}

export interface DimTopic {
  topic_id: number;
  topic_name: string;
}

export interface DimVerdict {
  verdict_id: number;
  verdict_name: "FAKE" | "REAL";
}

export interface DimSource {
  source_id: number;
  source_name: string;
  source_category: string;
}

export interface FactVerification {
  verification_id: string;
  date_id: string;
  topic_id: number;
  verdict_id: number;
  source_ids: number[];
  confidence_score: number;
  confidence_band: ConfidenceBand;
  text: string;
  scores: Record<AspectId, number>;
}

export interface Warehouse {
  facts: FactVerification[];
  dimDate: DimDate[];
  dimTopic: DimTopic[];
  dimVerdict: DimVerdict[];
  dimSource: DimSource[];
  stats: PipelineStats;
}

export interface PipelineStats {
  rawRecords: number;
  cleanRecords: number;
  duplicatesRemoved: number;
  missingValuesHandled: number;
  warehouseRecords: number;
  topics: number;
  fakeClaims: number;
  realClaims: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function normaliseTopic(t: unknown): string {
  if (typeof t !== "string" || !t.trim()) return "uncategorised";
  return t.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function normaliseVerdict(v: unknown): "FAKE" | "REAL" {
  return String(v ?? "").trim().toUpperCase() === "FAKE" ? "FAKE" : "REAL";
}

function clampScore(n: unknown): { value: number; imputed: boolean } {
  const num = typeof n === "number" && Number.isFinite(n) ? n : NaN;
  if (Number.isNaN(num)) return { value: 50, imputed: true };
  return { value: Math.max(0, Math.min(100, Math.round(num * 10) / 10)), imputed: false };
}

/** EXTRACT → TRANSFORM → LOAD. Safe against malformed/legacy records. */
export function buildWarehouse(records: VerificationRecord[]): Warehouse {
  const raw = Array.isArray(records) ? records : [];

  // --- TRANSFORM: de-duplicate on (text, timestamp) ---
  const seen = new Set<string>();
  const deduped: VerificationRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object" || typeof r.text !== "string" || !r.text.trim()) continue;
    const key = `${r.text.trim().toLowerCase()}|${r.submittedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  const duplicatesRemoved = raw.length - deduped.length;

  const dimDate = new Map<string, DimDate>();
  const dimTopic = new Map<string, DimTopic>();
  const dimVerdict: DimVerdict[] = [
    { verdict_id: 0, verdict_name: "FAKE" },
    { verdict_id: 1, verdict_name: "REAL" },
  ];
  const dimSource = new Map<string, DimSource>();
  const facts: FactVerification[] = [];
  let missingValuesHandled = 0;

  for (const r of deduped) {
    const result = r.result ?? ({} as VerificationRecord["result"]);

    // Date dimension
    const parsed = new Date(r.submittedAt);
    const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    if (Number.isNaN(parsed.getTime())) missingValuesHandled++;
    const date_id = d.toISOString().slice(0, 10);
    if (!dimDate.has(date_id)) {
      dimDate.set(date_id, {
        date_id,
        date: date_id,
        day: d.getDate(),
        month: d.getMonth() + 1,
        monthName: MONTHS[d.getMonth()] ?? "Jan",
        year: d.getFullYear(),
      });
    }

    // Topic dimension (primary topic per fact row)
    const topicsRaw = Array.isArray(result.topics) ? result.topics : [];
    if (topicsRaw.length === 0) missingValuesHandled++;
    const topic_name = normaliseTopic(topicsRaw[0]);
    if (!dimTopic.has(topic_name)) {
      dimTopic.set(topic_name, { topic_id: dimTopic.size, topic_name });
    }

    // Verdict dimension
    const verdict_name = normaliseVerdict(result.label);
    const verdict_id = verdict_name === "FAKE" ? 0 : 1;

    // Source dimension
    const source_ids: number[] = [];
    for (const s of Array.isArray(result.sources) ? result.sources : []) {
      const src = (s as { source?: { name?: string }; topic?: string })?.source;
      const name = (src?.name ?? (s as { name?: string })?.name)?.trim();
      if (!name) continue;
      const category = normaliseTopic((s as { topic?: string })?.topic);
      if (!dimSource.has(name)) {
        dimSource.set(name, { source_id: dimSource.size, source_name: name, source_category: category });
      }
      source_ids.push(dimSource.get(name)!.source_id);
    }

    // Measures
    const conf = clampScore(result.confidenceScore);
    if (conf.imputed) missingValuesHandled++;
    const aspectMap = new Map<string, number>();
    for (const a of Array.isArray(result.aspects) ? result.aspects : []) {
      if (a && typeof a.id === "string") aspectMap.set(a.id, a.score);
    }
    const scores = {} as Record<AspectId, number>;
    for (const id of ASPECT_IDS) {
      const v = clampScore(aspectMap.get(id));
      if (v.imputed) missingValuesHandled++;
      scores[id] = v.value;
    }

    facts.push({
      verification_id: r.id,
      date_id,
      topic_id: dimTopic.get(topic_name)!.topic_id,
      verdict_id,
      source_ids,
      confidence_score: conf.value,
      confidence_band: bandFor(conf.value),
      text: r.text,
      scores,
    });
  }

  const fakeClaims = facts.filter((f) => f.verdict_id === 0).length;

  return {
    facts,
    dimDate: [...dimDate.values()].sort((a, b) => a.date_id.localeCompare(b.date_id)),
    dimTopic: [...dimTopic.values()],
    dimVerdict,
    dimSource: [...dimSource.values()],
    stats: {
      rawRecords: raw.length,
      cleanRecords: deduped.length,
      duplicatesRemoved,
      missingValuesHandled,
      warehouseRecords: facts.length,
      topics: dimTopic.size,
      fakeClaims,
      realClaims: facts.length - fakeClaims,
    },
  };
}

export function topicName(wh: Warehouse, id: number) {
  return wh.dimTopic.find((t) => t.topic_id === id)?.topic_name ?? "unknown";
}

export function verdictName(id: number): "FAKE" | "REAL" {
  return id === 0 ? "FAKE" : "REAL";
}

export function dateOf(wh: Warehouse, id: string) {
  return wh.dimDate.find((d) => d.date_id === id);
}
