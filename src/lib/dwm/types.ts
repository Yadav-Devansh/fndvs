/**
 * Shared types for the historical-headlines DWM pipeline.
 * "risk" always means the scorer flagged a headline as FAKE-style writing
 * (a risk signal) — never a proven-false label.
 */

import type { AspectId } from "./etl";

export interface ScoredHeadline {
  id: number;
  date: string;
  year: number;
  month: number;
  category: string;
  text: string;
  /** 0 = FAKE-style (risk signal), 1 = REAL-style. */
  verdict: 0 | 1;
  confidence: number;
  scores: Record<AspectId, number>;
  keywords: string[];
}

export interface CubeCell {
  year: number;
  month: number;
  category: string;
  total: number;
  risk: number;
  confSum: number;
  lowConf: number;
  aspectSum: Record<AspectId, number>;
  aspectFail: Record<AspectId, number>;
}

export interface KeywordStat {
  word: string;
  count: number;
  risk: number;
}

export interface DroppedCounts {
  empty: number;
  duplicate: number;
  badDate: number;
  outOfWindow: number;
  other: number;
}

export interface ClassMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  /** [[TP, FN], [FP, TN]] with FAKE as the positive class. */
  confusion: { tp: number; fn: number; fp: number; tn: number };
}

export interface LabelledValidation {
  datasetName: string;
  total: number;
  fakeCount: number;
  realCount: number;
  trainSize: number;
  testSize: number;
  threshold: number;
  ruleBased: ClassMetrics;
  naiveBayes: ClassMetrics;
  baselineAccuracy: number;
  baselineLabel: "FAKE" | "REAL";
}

export interface DwmMeta {
  datasetId: string;
  datasetName: string;
  source: string;
  isSynthetic: boolean;
  windowStart: string;
  windowEnd: string;
  windowYears: number;
  rowsRead: number;
  rowsKept: number;
  rowsScored: number;
  dropped: DroppedCounts;
  builtAt: string;
  scorerVersion: string;
  processingMode: string;
}

export interface DwmAggregates {
  meta: DwmMeta;
  cube: CubeCell[];
  keywordsByYear: Record<string, KeywordStat[]>;
  keywordsByCategory: Record<string, KeywordStat[]>;
  sample: ScoredHeadline[];
  labelled?: LabelledValidation;
}

export const SCORER_VERSION = "fndvs-rule-scorer-1.0";
