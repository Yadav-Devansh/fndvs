/**
 * DWM Concept: OLAP over the pre-aggregated cube + trend analysis.
 * The cube stores sums only, so every roll-up here is exact.
 */

import { ASPECT_IDS, ASPECT_LABELS, type AspectId } from "./etl";
import type { CubeCell, DwmAggregates } from "./types";

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
export const fmtIN = (n: number) => Math.round(n).toLocaleString("en-IN");
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------- OLAP

export interface Dice {
  yearFrom?: number;
  yearTo?: number;
  categories?: string[];
}

/** Slice (single year) and dice (year range + categories). */
export function dice(cube: CubeCell[], d: Dice): CubeCell[] {
  return cube.filter(
    (c) =>
      (d.yearFrom === undefined || c.year >= d.yearFrom) &&
      (d.yearTo === undefined || c.year <= d.yearTo) &&
      (!d.categories || d.categories.length === 0 || d.categories.includes(c.category)),
  );
}

export const slice = (cube: CubeCell[], year: number) => dice(cube, { yearFrom: year, yearTo: year });

export interface Rolled {
  key: string;
  total: number;
  risk: number;
  confSum: number;
  lowConf: number;
  aspectSum: Record<AspectId, number>;
  aspectFail: Record<AspectId, number>;
}

export type Grain = "month" | "quarter" | "year" | "category" | "all" | "category-year";

function keyOf(c: CubeCell, g: Grain): string {
  switch (g) {
    case "month": return `${c.year}-${String(c.month).padStart(2, "0")}`;
    case "quarter": return `${c.year}-Q${Math.ceil(c.month / 3)}`;
    case "year": return String(c.year);
    case "category": return c.category;
    case "category-year": return `${c.category}|${c.year}`;
    case "all": return "All";
  }
}

/** Roll-up: month → quarter → year, category → All. */
export function rollUp(cube: CubeCell[], g: Grain): Rolled[] {
  const m = new Map<string, Rolled>();
  for (const c of cube) {
    const key = keyOf(c, g);
    let r = m.get(key);
    if (!r) {
      const z = () => Object.fromEntries(ASPECT_IDS.map((id) => [id, 0])) as Record<AspectId, number>;
      r = { key, total: 0, risk: 0, confSum: 0, lowConf: 0, aspectSum: z(), aspectFail: z() };
      m.set(key, r);
    }
    r.total += c.total; r.risk += c.risk; r.confSum += c.confSum; r.lowConf += c.lowConf;
    for (const id of ASPECT_IDS) { r.aspectSum[id] += c.aspectSum[id]; r.aspectFail[id] += c.aspectFail[id]; }
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export const riskRate = (r: { risk: number; total: number }) => pct(r.risk, r.total);

// ---------------------------------------------------------------- trends

export interface MonthPoint {
  key: string;
  label: string;
  total: number;
  rate: number;
  ma: number | null;
  spike: boolean;
  event?: string;
}

export const EVENTS: { key: string; label: string }[] = [
  { key: "2016-11", label: "Demonetisation announced" },
  { key: "2017-07", label: "GST introduced" },
  { key: "2019-02", label: "Pulwama attack" },
  { key: "2019-04", label: "General election (Apr–May)" },
  { key: "2019-05", label: "General election (Apr–May)" },
  { key: "2019-08", label: "Article 370 changes" },
  { key: "2019-12", label: "CAA protests" },
  { key: "2020-03", label: "COVID-19 lockdown" },
];

export function linearFit(ys: number[]) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const xm = (n - 1) / 2;
  const ym = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  ys.forEach((y, x) => { sxy += (x - xm) * (y - ym); sxx += (x - xm) ** 2; syy += (y - ym) ** 2; });
  const slope = sxx ? sxy / sxx : 0;
  const r2v = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept: ym - slope * xm, r2: r2v };
}

export function monthlyTrend(cube: CubeCell[], window = 3) {
  const rows = rollUp(cube, "month");
  const rates = rows.map(riskRate);
  const mean = rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length);
  const std = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rates.length));
  const points: MonthPoint[] = rows.map((r, i) => {
    const from = Math.max(0, i - window + 1);
    const seg = rows.slice(from, i + 1);
    const ma = i + 1 >= window ? pct(seg.reduce((a, s) => a + s.risk, 0), seg.reduce((a, s) => a + s.total, 0)) : null;
    const [y, m] = r.key.split("-");
    const ev = EVENTS.find((e) => e.key === r.key);
    const p: MonthPoint = {
      key: r.key, label: `${MONTHS[Number(m) - 1]} ${y}`, total: r.total,
      rate: r2(rates[i]!), ma: ma === null ? null : r2(ma), spike: rates[i]! > mean + 1.5 * std,
    };
    if (ev) p.event = ev.label;
    return p;
  });
  const fit = linearFit(rates);
  const direction: "increasing" | "decreasing" | "roughly flat" =
    fit.slope > 0.05 ? "increasing" : fit.slope < -0.05 ? "decreasing" : "roughly flat";
  const peak = [...points].sort((a, b) => b.rate - a.rate)[0];
  return { points, mean: r2(mean), std: r2(std), slope: fit.slope, r2: fit.r2, direction, peak };
}

export function yearly(cube: CubeCell[]) {
  const rows = rollUp(cube, "year");
  return rows.map((r, i) => {
    const rate = riskRate(r);
    const prev = rows[i - 1];
    return {
      year: r.key,
      total: r.total,
      risk: r.risk,
      real: r.total - r.risk,
      rate: r2(rate),
      avgConf: r1(r.confSum / r.total),
      lowConfPct: r1(pct(r.lowConf, r.total)),
      changePP: prev ? r2(rate - riskRate(prev)) : null,
    };
  });
}

export function categories(cube: CubeCell[]) {
  const all = rollUp(cube, "all")[0];
  const total = all?.total ?? 0;
  return rollUp(cube, "category")
    .map((r) => ({
      category: r.key,
      total: r.total,
      risk: r.risk,
      rate: r2(riskRate(r)),
      share: r1(pct(r.total, total)),
      avgConf: r1(r.confSum / r.total),
      small: r.total < 200,
    }))
    .sort((a, b) => b.rate - a.rate);
}

export function heatmap(cube: CubeCell[]) {
  const years = [...new Set(cube.map((c) => c.year))].sort();
  const cats = [...new Set(cube.map((c) => c.category))].sort();
  const cells = new Map(rollUp(cube, "category-year").map((r) => [r.key, r]));
  return {
    years,
    rows: cats.map((cat) => ({
      category: cat,
      values: years.map((y) => {
        const c = cells.get(`${cat}|${y}`);
        return c ? { rate: r2(riskRate(c)), total: c.total } : null;
      }),
    })),
  };
}

export function aspects(cube: CubeCell[]) {
  const all = rollUp(cube, "all")[0];
  const years = rollUp(cube, "year");
  const first = years[0];
  const last = years[years.length - 1];
  if (!all) return [];
  return ASPECT_IDS.map((id) => ({
    id,
    aspect: ASPECT_LABELS[id],
    avg: r1(all.aspectSum[id] / all.total),
    failRate: r2(pct(all.aspectFail[id], all.total)),
    firstFail: first ? r2(pct(first.aspectFail[id], first.total)) : 0,
    lastFail: last ? r2(pct(last.aspectFail[id], last.total)) : 0,
    changePP: first && last ? r2(pct(last.aspectFail[id], last.total) - pct(first.aspectFail[id], first.total)) : 0,
    perYear: years.map((y) => ({ year: y.key, avg: r1(y.aspectSum[id] / y.total), fail: r2(pct(y.aspectFail[id], y.total)) })),
  }));
}

export function totals(agg: DwmAggregates) {
  const all = rollUp(agg.cube, "all")[0];
  return {
    total: all?.total ?? 0,
    risk: all?.risk ?? 0,
    rate: all ? r2(riskRate(all)) : 0,
    avgConf: all ? r1(all.confSum / all.total) : 0,
    lowConfPct: all ? r1(pct(all.lowConf, all.total)) : 0,
  };
}

/** Top keywords overall vs. among risk-signal headlines. */
export function topKeywords(agg: DwmAggregates, n = 12) {
  const m = new Map<string, { count: number; risk: number }>();
  for (const list of Object.values(agg.keywordsByYear))
    for (const k of list) {
      const e = m.get(k.word) ?? { count: 0, risk: 0 };
      e.count += k.count; e.risk += k.risk; m.set(k.word, e);
    }
  const arr = [...m].map(([word, v]) => ({ word, ...v }));
  return {
    all: [...arr].sort((a, b) => b.count - a.count).slice(0, n),
    risky: [...arr].filter((a) => a.risk > 0).sort((a, b) => b.risk - a.risk).slice(0, n),
  };
}
