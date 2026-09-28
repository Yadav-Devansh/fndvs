/**
 * DWM Concept: K-Means on the historical sample (reuses the deterministic
 * kmeans.ts), plus elbow (inertia vs k), silhouette and centroid-based labels.
 */

import { ASPECT_IDS, ASPECT_SHORT, bandFor, type AspectId, type FactVerification } from "./etl";
import { kmeans } from "./kmeans";
import type { ScoredHeadline } from "./types";

export function toFacts(rows: ScoredHeadline[]): FactVerification[] {
  return rows.map((r) => ({
    verification_id: String(r.id),
    date_id: r.date,
    topic_id: 0,
    verdict_id: r.verdict,
    source_ids: [],
    confidence_score: r.confidence,
    confidence_band: bandFor(r.confidence),
    text: r.text,
    scores: r.scores,
  }));
}

const vec = (s: Record<AspectId, number>) => ASPECT_IDS.map((id) => s[id] / 100);
const d2 = (a: number[], b: number[]) => a.reduce((s, x, i) => s + (x - (b[i] ?? 0)) ** 2, 0);

function labelFromCentroid(c: Record<AspectId, number>): string {
  const weakest = [...ASPECT_IDS].sort((a, b) => c[a] - c[b]).filter((id) => c[id] < 70).slice(0, 2);
  if (weakest.length === 0) return "Well-attributed neutral";
  return `Weak ${weakest.map((w) => ASPECT_SHORT[w].toLowerCase()).join(" + ")}`;
}

export function clusterSample(rows: ScoredHeadline[], k: number) {
  const facts = toFacts(rows);
  const res = kmeans(facts, k);
  const labels = facts.map((f) => res.assignments.get(f.verification_id) ?? 0);
  const clusters = res.clusters.map((c) => {
    const members = rows.filter((_, i) => labels[i] === c.clusterId);
    const cats = new Map<string, number>();
    for (const m of members) cats.set(m.category, (cats.get(m.category) ?? 0) + 1);
    return {
      ...c,
      label: labelFromCentroid(c.avgScores),
      topCategories: [...cats].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${n} (${Math.round((v / members.length) * 100)}%)`),
    };
  });
  // Scatter on the two highest-variance aspects.
  const variance = ASPECT_IDS.map((id) => {
    const xs = rows.map((r) => r.scores[id]);
    const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return { id, v: xs.reduce((a, b) => a + (b - m) ** 2, 0) };
  }).sort((a, b) => b.v - a.v);
  const ax = variance[0]!.id, ay = variance[1]!.id;
  const step = Math.max(1, Math.floor(rows.length / 1500));
  const points: { x: number; y: number; c: number }[] = [];
  for (let i = 0; i < rows.length; i += step) points.push({ x: rows[i]!.scores[ax], y: rows[i]!.scores[ay], c: labels[i] ?? 0 });
  return { clusters, labels, axes: [ax, ay] as [AspectId, AspectId], points, silhouette: silhouette(rows, labels) };
}

export function inertia(rows: ScoredHeadline[], k: number): number {
  const facts = toFacts(rows);
  const res = kmeans(facts, k);
  const byC = new Map<number, number[][]>();
  facts.forEach((f, i) => {
    const c = res.assignments.get(f.verification_id) ?? 0;
    const arr = byC.get(c) ?? [];
    arr.push(vec(rows[i]!.scores));
    byC.set(c, arr);
  });
  let total = 0;
  for (const pts of byC.values()) {
    const cen = pts[0]!.map((_, d) => pts.reduce((s, p) => s + (p[d] ?? 0), 0) / pts.length);
    for (const p of pts) total += d2(p, cen);
  }
  return Math.round(total * 100) / 100;
}

/** Mean silhouette on a deterministic subsample of up to 2,000 rows. */
export function silhouette(rows: ScoredHeadline[], labels: number[]): number {
  const step = Math.max(1, Math.floor(rows.length / 2000));
  const idx = rows.map((_, i) => i).filter((i) => i % step === 0);
  const pts = idx.map((i) => vec(rows[i]!.scores));
  const lab = idx.map((i) => labels[i] ?? 0);
  const ks = [...new Set(lab)];
  if (ks.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const dist = new Map<number, { s: number; n: number }>();
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const e = dist.get(lab[j]!) ?? { s: 0, n: 0 };
      e.s += Math.sqrt(d2(pts[i]!, pts[j]!)); e.n++;
      dist.set(lab[j]!, e);
    }
    const own = dist.get(lab[i]!);
    const a = own && own.n ? own.s / own.n : 0;
    let b = Infinity;
    for (const [c, e] of dist) if (c !== lab[i] && e.n) b = Math.min(b, e.s / e.n);
    const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
    sum += Number.isFinite(s) ? s : 0;
  }
  return Math.round((sum / pts.length) * 1000) / 1000;
}
