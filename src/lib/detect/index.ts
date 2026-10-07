/**
 * Linguistic risk signals. Reads the WORDING of a text — tone, pressure, framing.
 * It does not check facts and can never call a claim credible.
 */
import { matchSources, topicHitCounts, topicsFromHits, type SourceMatch, type Topic, type TopicHits } from "../sources";
import { CLICKBAIT_PATTERNS, EMOTION_TERMS, FORWARD_CHAIN_TERMS, HEDGING_TERMS, URGENCY_TERMS } from "./lexicon";
import {
  detectDebunk,
  detectLanguage,
  findAttribution,
  findBodies,
  findDates,
  findNumbers,
  findTerms,
  sensationalHits,
  type Language,
} from "./signals";
import { tokenize } from "./tokenize";

export type LanguageRisk = "low" | "medium" | "high" | "unknown";
/** The rule engine alone can only say "unverified" or "likely-misleading". */
export type EngineVerdict = "unverified" | "likely-misleading";
export type EvidenceStrength = "strong" | "moderate" | "weak" | "none";
export type AspectVerdict = "pass" | "warn" | "fail" | "unchecked";

export interface Aspect {
  id: string;
  label: string;
  /** 0-100, higher = calmer wording on this dimension. null = not checked. */
  score: number | null;
  verdict: AspectVerdict;
  detail: string;
  evidence: string[];
}

export interface DetectionResult {
  verdict: EngineVerdict;
  languageRisk: LanguageRisk;
  /** 0-100 integer; higher = more risky wording. */
  riskScore: number;
  evidenceStrength: EvidenceStrength;
  language: Language;
  debunkFraming: boolean;
  hedging: string[];
  dates: string[];
  namedBodies: string[];
  claimedAttribution: string[];
  aspects: Aspect[];
  topics: Topic[];
  topicHits: TopicHits;
  sources: SourceMatch[];
  wordCount: number;
  keyTerms: string[];
  summary: string;
  notices: string[];
}

export const NON_ENGLISH_NOTICE =
  "The rule engine only reads English. Use the fact-check lookup for this text.";
export const DEBUNK_NOTICE = "This text appears to debunk a claim. Verify the original claim instead.";
export const ATTRIBUTION_NOTE = "claimed attribution, unverified until checked at the source";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const verdictFor = (score: number): AspectVerdict => (score >= 70 ? "pass" : score >= 45 ? "warn" : "fail");

export function languageRiskFor(riskScore: number): Exclude<LanguageRisk, "unknown"> {
  return riskScore >= 60 ? "high" : riskScore >= 25 ? "medium" : "low";
}

/** Only high risk + urgency/forward-chain pressure may produce "likely-misleading". */
export function engineVerdict(risk: LanguageRisk, pressure: boolean): EngineVerdict {
  return risk === "high" && pressure ? "likely-misleading" : "unverified";
}

/** Wording alone is weak evidence at best. Strong/moderate need external evidence (Phase 3). */
export function evidenceStrengthFor(verdict: EngineVerdict): EvidenceStrength {
  return verdict === "likely-misleading" ? "weak" : "none";
}

export function analyze(rawText: string): DetectionResult {
  const raw = rawText.trim();
  const tokens = tokenize(raw);
  const language = detectLanguage(raw);
  const debunkFraming = detectDebunk(tokens);

  const sensational = sensationalHits(tokens, debunkFraming);
  const hedging = findTerms(tokens, HEDGING_TERMS);
  const emotions = findTerms(tokens, EMOTION_TERMS);
  const urgency = findTerms(tokens, URGENCY_TERMS);
  const forwardChain = findTerms(tokens, FORWARD_CHAIN_TERMS);
  const clickbait = findTerms(tokens, CLICKBAIT_PATTERNS);
  const bodies = findBodies(tokens, raw);
  const claimedAttribution = findAttribution(tokens, bodies);
  const dates = findDates(tokens);
  const numbers = findNumbers(raw);

  const letters = raw.replace(/[^A-Za-z]/g, "");
  const capsRatio = letters ? (raw.match(/[A-Z]/g) ?? []).length / letters.length : 0;
  const bangs = (raw.match(/[!?]+/g) ?? []).length;

  const sensationalWeight = sensational.reduce((s, h) => s + h.weight, 0);
  const sensationalScore = Math.round(clamp(100 - sensationalWeight * 3, 5));
  const emotionScore = clamp(96 - emotions.length * 22, 8);
  const urgencyScore = clamp(95 - urgency.length * 25, 10);
  const clickbaitScore = clamp(94 - clickbait.length * 30, 10);
  const styleScore = Math.round(clamp(98 - Math.max(0, capsRatio - 0.12) * 260 - bangs * 12, 8));
  const specificityScore = clamp(26 + numbers.length * 11 + dates.length * 14, 0, 96);

  // Risk comes only from pressure/tone signals. Attribution and specificity never lower it.
  const riskScore = Math.round(
    clamp(
      sensationalWeight * 2 +
        emotions.length * 12 +
        urgency.length * 18 +
        forwardChain.length * 10 +
        clickbait.length * 20 +
        Math.max(0, capsRatio - 0.12) * 120 +
        bangs * 6,
    ),
  );

  const notices: string[] = [];
  let languageRisk: LanguageRisk;
  if (language === "non-english") {
    languageRisk = "unknown";
    notices.push(NON_ENGLISH_NOTICE);
  } else {
    languageRisk = languageRiskFor(riskScore);
  }
  if (debunkFraming) notices.push(DEBUNK_NOTICE);

  const verdict = engineVerdict(languageRisk, urgency.length > 0 || forwardChain.length > 0);
  const topicHits = topicHitCounts(tokens, raw);
  const topics = topicsFromHits(topicHits);
  const sources = matchSources(topicHits);
  const namedBodies = bodies.map((b) => b.name);

  const aspects: Aspect[] = [
    {
      id: "sensational",
      label: "Sensational vocabulary",
      score: sensationalScore,
      verdict: verdictFor(sensationalScore),
      detail: sensational.length
        ? `${sensational.length} sensational term${sensational.length === 1 ? "" : "s"} detected.`
        : "No obvious sensational or hype vocabulary detected.",
      evidence: [...sensational].sort((a, b) => b.weight - a.weight).slice(0, 6).map((h) => h.term),
    },
    {
      id: "attribution",
      label: "Claimed attribution",
      score: null,
      verdict: "unchecked",
      detail: claimedAttribution.length
        ? `The text names a source — ${ATTRIBUTION_NOTE}. It does not make the claim more credible.`
        : namedBodies.length
          ? "A body is named, but nothing is attributed to it. Naming a body is not attribution."
          : "No source is named for the claim.",
      evidence: claimedAttribution.slice(0, 6),
    },
    {
      id: "emotion",
      label: "Emotional tone",
      score: emotionScore,
      verdict: verdictFor(emotionScore),
      detail: emotions.length
        ? "Emotive framing is used where neutral reporting language would be expected."
        : "Tone reads as broadly neutral.",
      evidence: emotions.slice(0, 6),
    },
    {
      id: "urgency",
      label: "Urgency & forwarding pressure",
      score: urgencyScore,
      verdict: verdictFor(urgencyScore),
      detail: urgency.length || forwardChain.length
        ? "Contains pressure to share or act before checking — a common forward-chain marker."
        : "No forwarding pressure or artificial deadline detected.",
      evidence: [...new Set([...urgency, ...forwardChain])].slice(0, 6),
    },
    {
      id: "specificity",
      label: "Checkable details",
      score: specificityScore,
      verdict: verdictFor(specificityScore),
      detail: numbers.length || dates.length
        ? `${numbers.length} figure${numbers.length === 1 ? "" : "s"} and ${dates.length} date${dates.length === 1 ? "" : "s"} you can check. Specifics are not proof.`
        : "No dates or figures — the claim is hard to pin down.",
      evidence: [...numbers.slice(0, 4), ...dates.slice(0, 2)],
    },
    {
      id: "style",
      label: "Writing style",
      score: styleScore,
      verdict: verdictFor(styleScore),
      detail:
        capsRatio > 0.2 || bangs > 2
          ? "Heavy capitalisation or repeated exclamation — typical of forwarded messages."
          : "Capitalisation and punctuation are within normal range.",
      evidence: [`${Math.round(capsRatio * 100)}% uppercase letters`, `${bangs} exclamation/question marks`],
    },
    {
      id: "clickbait",
      label: "Clickbait framing",
      score: clickbaitScore,
      verdict: verdictFor(clickbaitScore),
      detail: clickbait.length
        ? "Uses curiosity-gap headline formulas rather than stating the news."
        : "States the claim directly rather than teasing it.",
      evidence: clickbait.slice(0, 4),
    },
    {
      id: "corroboration",
      label: "Corroboration",
      score: null,
      verdict: "unchecked",
      detail: "Not checked yet. Confirm the claim with the official sources listed below.",
      evidence: [],
    },
  ];

  const keyTerms = [
    ...sensational.map((h) => h.term),
    ...urgency,
    ...clickbait,
    ...emotions,
  ].filter((t, i, a) => a.indexOf(t) === i).slice(0, 6);

  const summary =
    languageRisk === "unknown"
      ? NON_ENGLISH_NOTICE
      : verdict === "likely-misleading"
        ? "The wording shows strong risk signals plus pressure to forward. That pattern is common in misleading messages — check before sharing."
        : `Language risk is ${languageRisk}. This reads the wording only, not the facts — the claim is unverified until confirmed with an official source.`;

  return {
    verdict,
    languageRisk,
    riskScore,
    evidenceStrength: evidenceStrengthFor(verdict),
    language,
    debunkFraming,
    hedging,
    dates,
    namedBodies,
    claimedAttribution,
    aspects,
    topics,
    topicHits,
    sources,
    wordCount: tokens.length,
    keyTerms,
    summary,
    notices,
  };
}
