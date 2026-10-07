/** Shapes shared by the evidence checks, the verdict rules and the report UI. */
import type { LanguageRisk } from "../detect";

export type RatingBucket = "false" | "misleading" | "true" | "mixed" | "unknown";
export type LookupStatus = "ok" | "not-configured" | "error" | "skipped";

export interface FactCheckRecord {
  /** Evidence id used in the Gemini evidence block, e.g. "F1". */
  id: string;
  publisher: string;
  url: string;
  title: string;
  /** The publisher's own rating text, verbatim. */
  rating: string;
  ratingBucket: RatingBucket;
  reviewedAt: string | null;
  claimText: string;
}

export interface FactCheckLookup {
  status: LookupStatus;
  records: FactCheckRecord[];
  message?: string;
}

export interface NewsArticle {
  /** Evidence id, e.g. "N1". */
  id: string;
  title: string;
  url: string;
  domain: string;
  seenAt: string | null;
  /** Domain is on the reputable-outlet allow-list. */
  reputable: boolean;
  /** Share of the key terms that appear in the title (0-1). */
  matchRatio: number;
}

export interface NewsLookup {
  status: LookupStatus;
  provider: "GDELT DOC 2.0";
  windowDays: number;
  keyTerms: string[];
  articles: NewsArticle[];
  corroboratingDomains: string[];
  corroborated: boolean;
  message?: string;
}

export type GroundedLabel = "supported" | "contradicted" | "unverifiable";

export interface GroundedGemini {
  verdict: GroundedLabel;
  confidence: number;
  reasoning: string;
  citedEvidenceIds: string[];
}

export interface GeminiLookup {
  status: LookupStatus;
  result?: GroundedGemini;
  message?: string;
}

export type FinalVerdict = "likely-misleading" | "likely-credible" | "unverified";
export type DecisionConfidence = "high" | "medium" | "low";

export interface Decision {
  verdict: FinalVerdict;
  confidence: DecisionConfidence;
  /** Which rule fired: a-f, as documented in decide.ts. */
  rule: "a" | "b" | "c" | "f";
  headline: string;
  reasons: string[];
  nextSteps: string[];
}

export interface EvidenceItem {
  id: string;
  kind: "fact-check" | "article" | "official-source";
  text: string;
}

export interface VerificationReport {
  checkedAt: string;
  decision: Decision;
  languageRisk: LanguageRisk;
  factCheck: FactCheckLookup;
  news: NewsLookup;
  gemini: GeminiLookup;
  officialSources: { id: string; name: string; url: string }[];
}
