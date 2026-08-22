/**
 * DWM Concept: K-Means clustering over the eight credibility aspect scores.
 * Deterministic (k-means++ style seeding with a fixed seed) so lab runs repeat.
 */

import { ASPECT_IDS, type AspectId, type FactVerification } from "./etl";

export interface ClusterSummary {
  clusterId: number;
  label: string;
  size: number;
  avgConfidence: number;
  avgScores: Record<AspectId, number>;
  overallScore: number;
  fakePct: number;
  realPct: number;
}

export interface KMeansResult {
  k: number;
  iterations: number;
  assignments: Map<string, number>;
  clusters: ClusterSummary[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function vectorOf(f: FactVerification): number[] {
  // Normalise 0-100 scores into 0-1 features.
  return ASPECT_IDS.map((id) => f.scores[id] / 100);
}

function distance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
  return s;
}

export function kmeans(facts: FactVerification[], k = 3, maxIter = 50): KMeansResult {
  const points = facts.map(vectorOf);
  const assignments = new Map<string, number>();

  if (points.length === 0) {
    return { k, iterations: 0, assignments, clusters: [] };
  }
  const effectiveK = Math.min(k, points.length);

  // Deterministic seeding: pick the points furthest apart.
  const centroids: number[][] = [points[0]!.slice()];
  while (centroids.length < effectiveK) {
    let best = 0;
    let bestDist = -1;
    points.forEach((p, i) => {
      const d = Math.min(...centroids.map((c) => distance(p, c)));
      if (d > bestDist) {
        bestDist = d;
        best = i;
      }
    });
    centroids.push(points[best]!.slice());
  }

  let labels = new Array(points.length).fill(0);
  let iterations = 0;

  for (let it = 0; it < maxIter; it++) {
    iterations = it + 1;
    let changed = false;
    const next = points.map((p) => {
      let bestIdx = 0;
      let bestD = Infinity;
      centroids.forEach((c, ci) => {
        const d = distance(p, c);
        if (d < bestD) {
          bestD = d;
          bestIdx = ci;
        }
      });
      return bestIdx;
    });
    for (let i = 0; i < next.length; i++) if (next[i] !== labels[i]) changed = true;
    labels = next;

    for (let ci = 0; ci < centroids.length; ci++) {
      const members = points.filter((_, i) => labels[i] === ci);
      if (!members.length) continue;
      centroids[ci] = members[0]!.map(
        (_, dim) => members.reduce((s, m) => s + (m[dim] ?? 0), 0) / members.length,
      );
    }
    if (!changed) break;
  }

  facts.forEach((f, i) => assignments.set(f.verification_id, labels[i] ?? 0));

  // Summarise, then derive labels from measured characteristics (never hard-coded).
  const summaries: ClusterSummary[] = [];
  for (let ci = 0; ci < effectiveK; ci++) {
    const members = facts.filter((_, i) => labels[i] === ci);
    if (!members.length) continue;
    const avgScores = {} as Record<AspectId, number>;
    for (const id of ASPECT_IDS) {
      avgScores[id] = round1(members.reduce((s, m) => s + m.scores[id], 0) / members.length);
    }
    const overall = round1(
      ASPECT_IDS.reduce((s, id) => s + avgScores[id], 0) / ASPECT_IDS.length,
    );
    const fake = members.filter((m) => m.verdict_id === 0).length;
    summaries.push({
      clusterId: ci,
      label: "",
      size: members.length,
      avgConfidence: round1(members.reduce((s, m) => s + m.confidence_score, 0) / members.length),
      avgScores,
      overallScore: overall,
      fakePct: round1((fake / members.length) * 100),
      realPct: round1(((members.length - fake) / members.length) * 100),
    });
  }

  const ranked = [...summaries].sort((a, b) => b.overallScore - a.overallScore);
  const names =
    ranked.length === 1
      ? ["Single credibility group"]
      : ranked.length === 2
        ? ["Higher credibility", "Lower credibility"]
        : ["Higher credibility", "Mixed / medium credibility", "Lower credibility"];
  ranked.forEach((c, i) => {
    c.label = names[Math.min(i, names.length - 1)] ?? `Cluster ${c.clusterId + 1}`;
  });

  return { k: effectiveK, iterations, assignments, clusters: summaries };
}
