/**
 * Validation against a labelled fake-news dataset. The FAKE/REAL cut-off is
 * chosen on a 70% training split (max F1), metrics are reported on the 30%
 * test split only.
 */

import { rng, scoreHeadline } from "./pipeline";
import { predictNB, trainNB } from "./naiveBayes";
import type { ClassMetrics, LabelledValidation } from "./types";

export interface LabelledItem {
  text: string;
  label: "FAKE" | "REAL";
}

export function metrics(truth: ("FAKE" | "REAL")[], pred: ("FAKE" | "REAL")[]): ClassMetrics {
  let tp = 0, fn = 0, fp = 0, tn = 0;
  truth.forEach((t, i) => {
    const p = pred[i];
    if (t === "FAKE" && p === "FAKE") tp++;
    else if (t === "FAKE") fn++;
    else if (p === "FAKE") fp++;
    else tn++;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const r = (n: number) => Math.round(n * 1000) / 10;
  return { accuracy: r((tp + tn) / Math.max(1, truth.length)), precision: r(precision), recall: r(recall), f1: r(f1), confusion: { tp, fn, fp, tn } };
}

export function validate(items: LabelledItem[], datasetName: string): LabelledValidation {
  const rand = rng(7);
  const byClass = { FAKE: [] as LabelledItem[], REAL: [] as LabelledItem[] };
  for (const it of items) byClass[it.label].push(it);
  const train: LabelledItem[] = [];
  const test: LabelledItem[] = [];
  for (const list of Object.values(byClass)) {
    const shuffled = list.map((x) => ({ x, k: rand() })).sort((a, b) => a.k - b.k).map((o) => o.x);
    const cut = Math.round(shuffled.length * 0.7);
    train.push(...shuffled.slice(0, cut));
    test.push(...shuffled.slice(cut));
  }
  // Continuous "fake-likelihood" from the rule scorer.
  const fakeness = (t: string) => {
    const s = scoreHeadline(t);
    return s.verdict === 0 ? s.confidence : 100 - s.confidence;
  };
  const trainScores = train.map((t) => fakeness(t.text));
  let best = 50, bestF1 = -1;
  for (let th = 5; th <= 95; th += 1) {
    const m = metrics(train.map((t) => t.label), trainScores.map((s) => (s >= th ? "FAKE" : "REAL")));
    if (m.f1 > bestF1) { bestF1 = m.f1; best = th; }
  }
  const truth = test.map((t) => t.label);
  const ruleBased = metrics(truth, test.map((t) => (fakeness(t.text) >= best ? "FAKE" : "REAL")));
  const nb = trainNB(train);
  const naiveBayes = metrics(truth, test.map((t) => predictNB(nb, t.text) as "FAKE" | "REAL"));
  const trainFake = train.filter((t) => t.label === "FAKE").length;
  const baselineLabel = trainFake >= train.length - trainFake ? "FAKE" : "REAL";
  const baselineAccuracy = Math.round((truth.filter((t) => t === baselineLabel).length / Math.max(1, truth.length)) * 1000) / 10;
  return {
    datasetName,
    total: items.length,
    fakeCount: byClass.FAKE.length,
    realCount: byClass.REAL.length,
    trainSize: train.length,
    testSize: test.length,
    threshold: best,
    ruleBased,
    naiveBayes,
    baselineAccuracy,
    baselineLabel,
  };
}

/** Map a raw label value to FAKE/REAL. `swap` flips 0/1 meaning. */
export function mapLabel(v: string, swap: boolean): "FAKE" | "REAL" | null {
  const s = (v ?? "").trim().toLowerCase();
  if (["fake", "false", "f", "misleading"].includes(s)) return "FAKE";
  if (["real", "true", "t"].includes(s)) return "REAL";
  if (s === "1") return swap ? "REAL" : "FAKE";
  if (s === "0") return swap ? "FAKE" : "REAL";
  return null;
}
