/**
 * Compatibility wrapper around the linguistic risk engine in ./detect.
 * Keeps the old field names (label, confidenceScore, explanation) so existing
 * screens keep working until Phase 3 replaces them.
 */
import { analyze, type DetectionResult } from "./detect";

export type { Aspect, AspectVerdict, DetectionResult, EngineVerdict, EvidenceStrength, LanguageRisk } from "./detect";

/** Legacy label. "REAL" is never produced any more; it only exists in old saved records. */
export type PredictionLabel = "FAKE" | "UNVERIFIED" | "REAL";

export interface PredictionResult extends DetectionResult {
  /** @deprecated use `verdict` */
  label: PredictionLabel;
  /** @deprecated equals `riskScore` (higher = riskier wording). */
  confidenceScore: number;
  /** @deprecated use `keyTerms` */
  explanation: string[];
  /** @deprecated use `wordCount` */
  readingLevelWords: number;
}

export const MIN_TEXT = 20;
export const MAX_TEXT = 5000;

export function predict(rawText: string): PredictionResult {
  const r = analyze(rawText);
  return {
    ...r,
    label: r.verdict === "likely-misleading" ? "FAKE" : "UNVERIFIED",
    confidenceScore: r.riskScore,
    explanation: r.keyTerms,
    readingLevelWords: r.wordCount,
  };
}

export const DISCLAIMER =
  "FNDVS reads the wording of a text for linguistic risk signals. It does not check facts. Always confirm a claim against the official source listed before acting on it.";
