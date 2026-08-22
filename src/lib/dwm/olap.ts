/**
 * DWM Concept: OLAP — slice, dice, roll-up, drill-down over the star schema.
 */

import {
  ASPECT_IDS,
  type AspectId,
  type ConfidenceBand,
  type FactVerification,
  type Warehouse,
  topicName,
} from "./etl";

export interface OlapFilters {
  topic: string; // "ALL" | topic_name
  verdict: string; // "ALL" | "FAKE" | "REAL"
  year: string; // "ALL" | "2026"
  month: string; // "ALL" | "3"
  band: string; // "ALL" | ConfidenceBand
}

export const EMPTY_FILTERS: OlapFilters = {
  topic: "ALL",
  verdict: "ALL",
  year: "ALL",
  month: "ALL",
  band: "ALL",
};

export function applyFilters(wh: Warehouse, f: OlapFilters): FactVerification[] {
  return wh.facts.filter((fact) => {
    const d = wh.dimDate.find((x) => x.date_id === fact.date_id);
    if (f.topic !== "ALL" && topicName(wh, fact.topic_id) !== f.topic) return false;
    if (f.verdict !== "ALL" && (fact.verdict_id === 0 ? "FAKE" : "REAL") !== f.verdict) return false;
    if (f.year !== "ALL" && String(d?.year) !== f.year) return false;
    if (f.month !== "ALL" && String(d?.month) !== f.month) return false;
    if (f.band !== "ALL" && fact.confidence_band !== f.band) return false;
    return true;
  });
}

const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
export const round1 = (n: number) => Math.round(n * 10) / 10;

export interface TopicRow {
  topic: string;
  fake: number;
  real: number;
  total: number;
  fakePct: number;
  avgConfidence: number;
  lowConfidence: number;
}

export function byTopic(wh: Warehouse, facts: FactVerification[]): TopicRow[] {
  const map = new Map<string, FactVerification[]>();
  for (const f of facts) {
    const t = topicName(wh, f.topic_id);
    map.set(t, [...(map.get(t) ?? []), f]);
  }
  return [...map.entries()]
    .map(([topic, rows]) => {
      const fake = rows.filter((r) => r.verdict_id === 0).length;
      return {
        topic,
        fake,
        real: rows.length - fake,
        total: rows.length,
        fakePct: round1((fake / rows.length) * 100),
        avgConfidence: round1(avg(rows.map((r) => r.confidence_score))),
        lowConfidence: rows.filter((r) => r.confidence_band === "Low").length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type TimeGrain = "day" | "month" | "year";

export interface TimeRow {
  period: string;
  fake: number;
  real: number;
  total: number;
  avgConfidence: number;
}

/** Roll-up (day → month → year) and drill-down are the same aggregation at different grains. */
export function byTime(wh: Warehouse, facts: FactVerification[], grain: TimeGrain): TimeRow[] {
  const map = new Map<string, FactVerification[]>();
  for (const f of facts) {
    const d = wh.dimDate.find((x) => x.date_id === f.date_id);
    if (!d) continue;
    const key =
      grain === "year"
        ? String(d.year)
        : grain === "month"
          ? `${d.monthName} ${d.year}`
          : d.date;
    map.set(key, [...(map.get(key) ?? []), f]);
  }
  return [...map.entries()]
    .map(([period, rows]) => {
      const fake = rows.filter((r) => r.verdict_id === 0).length;
      return {
        period,
        fake,
        real: rows.length - fake,
        total: rows.length,
        avgConfidence: round1(avg(rows.map((r) => r.confidence_score))),
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function byVerdictConfidence(facts: FactVerification[]) {
  return (["FAKE", "REAL"] as const).map((v) => {
    const rows = facts.filter((f) => (f.verdict_id === 0 ? "FAKE" : "REAL") === v);
    return {
      verdict: v,
      count: rows.length,
      avgConfidence: round1(avg(rows.map((r) => r.confidence_score))),
    };
  });
}

export function bandDistribution(facts: FactVerification[]) {
  const bands: ConfidenceBand[] = ["Strong", "Moderate", "Low"];
  return bands.map((band) => ({
    band,
    count: facts.filter((f) => f.confidence_band === band).length,
  }));
}

export interface AspectRow {
  id: AspectId;
  aspect: string;
  avg: number;
  failRate: number;
  fakeAvg: number;
  realAvg: number;
  gap: number;
}

export function aspectProfile(facts: FactVerification[], labels: Record<AspectId, string>): AspectRow[] {
  const fake = facts.filter((f) => f.verdict_id === 0);
  const real = facts.filter((f) => f.verdict_id === 1);
  return ASPECT_IDS.map((id) => {
    const all = facts.map((f) => f.scores[id]);
    const fakeAvg = round1(avg(fake.map((f) => f.scores[id])));
    const realAvg = round1(avg(real.map((f) => f.scores[id])));
    return {
      id,
      aspect: labels[id],
      avg: round1(avg(all)),
      failRate: facts.length ? round1((all.filter((s) => s < 45).length / facts.length) * 100) : 0,
      fakeAvg,
      realAvg,
      gap: round1(Math.abs(realAvg - fakeAvg)),
    };
  });
}
