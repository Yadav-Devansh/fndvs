/**
 * MOCK ANALYSIS ENGINE — deterministic, explainable heuristics.
 *
 * MOCK — replace with a real NLP service (TF-IDF + Logistic Regression, or an
 * LLM verifier) in production. Everything below runs in-process and is exposed
 * over `POST /api/public/predict` so the API contract stays identical.
 */

import { detectTopics, matchSources, type SourceMatch, type Topic } from "./sources";

export type PredictionLabel = "FAKE" | "REAL";

export type AspectVerdict = "pass" | "warn" | "fail";

export interface Aspect {
  id: string;
  label: string;
  /** 0-100, higher = more trustworthy on this dimension. */
  score: number;
  verdict: AspectVerdict;
  detail: string;
  evidence: string[];
}

export interface PredictionResult {
  label: PredictionLabel;
  confidenceScore: number;
  explanation: string[];
  aspects: Aspect[];
  topics: Topic[];
  sources: SourceMatch[];
  readingLevelWords: number;
  summary: string;
}

export const MIN_TEXT = 20;
export const MAX_TEXT = 5000;
export const LOW_CONFIDENCE_THRESHOLD = 60;

const FAKE_TERMS: Record<string, number> = {
  shocking: 9, miracle: 9, "you won't believe": 10, "you will not believe": 10,
  exposed: 8, secretly: 8, secret: 6, leaked: 7, allegedly: 5, rumours: 7,
  rumors: 7, viral: 5, hoax: 6, conspiracy: 8, unbelievable: 8, overnight: 5,
  furious: 5, "hidden truth": 10, "they don't want you to know": 10,
  "doctors hate": 10, "share before": 9, "forward this": 9, "must read": 7,
  anonymous: 5, claims: 4, cure: 5, banned: 5, "no evidence": 7, "wake up": 6,
  "mainstream media": 7, "big pharma": 9, "100% guaranteed": 10, "act now": 7,
};

const REAL_TERMS: Record<string, number> = {
  according: 7, announced: 6, confirmed: 7, officials: 7, official: 6,
  statement: 6, ministry: 6, department: 5, agency: 5, "peer-reviewed": 10,
  researchers: 7, study: 5, journal: 6, published: 6, report: 5, reported: 5,
  data: 4, percent: 4, survey: 5, briefing: 6, "press conference": 8,
  "regulatory filing": 9, spokesperson: 7, council: 4, advisory: 5,
  gazette: 8, notification: 5, "press release": 8, parliament: 6,
};

const EMOTION_TERMS = [
  "shocking", "outrageous", "furious", "terrifying", "disgusting", "horrific",
  "unbelievable", "insane", "destroyed", "slammed", "panic", "chaos", "war",
];

const URGENCY_TERMS = [
  "share before", "forward this", "act now", "urgent", "immediately", "last chance",
  "breaking", "just in", "before it's deleted", "delete", "hurry", "only today",
];

const CLICKBAIT_PATTERNS = [
  "you won't believe", "you will not believe", "what happened next", "this one trick",
  "doctors hate", "number 7", "will shock you", "gone wrong", "the truth about",
];

const ATTRIBUTION_PATTERNS = [
  "according to", "said in a statement", "told reporters", "press release",
  "spokesperson", "confirmed by", "as per the", "in a notification", "official said",
];

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","at","by","from",
  "that","this","it","is","are","was","were","be","been","as","has","have","had",
  "will","would","not","no","its","their","they","he","she","we","you","said",
]);

function clean(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Stable string hash so identical text always yields the same score. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function verdictFor(score: number): AspectVerdict {
  return score >= 70 ? "pass" : score >= 45 ? "warn" : "fail";
}

function found(list: string[], text: string): string[] {
  return list.filter((t) => text.includes(t));
}

export function predict(rawText: string): PredictionResult {
  const text = clean(rawText);
  const raw = rawText.trim();
  const words = text ? text.split(" ") : [];
  const seed = hash(text);

  let fakeScore = 0;
  let realScore = 0;
  const fakeHits: { term: string; weight: number }[] = [];
  const realHits: { term: string; weight: number }[] = [];

  for (const [term, weight] of Object.entries(FAKE_TERMS)) {
    if (text.includes(term)) { fakeScore += weight; fakeHits.push({ term, weight }); }
  }
  for (const [term, weight] of Object.entries(REAL_TERMS)) {
    if (text.includes(term)) { realScore += weight; realHits.push({ term, weight }); }
  }

  // ---- Aspect 1: sensational vocabulary -------------------------------------
  const sensationalDensity = fakeHits.length / Math.max(12, words.length / 12);
  const sensational = Math.round(Math.max(6, 100 - sensationalDensity * 120 - fakeScore * 1.6));

  // ---- Aspect 2: source attribution ----------------------------------------
  const attributions = found(ATTRIBUTION_PATTERNS, text);
  const namedBodies = found(
    ["ministry", "government", "rbi", "niti aayog", "isro", "icmr", "who", "commission", "department", "authority"],
    text,
  );
  const attributionScore = Math.min(
    97,
    22 + attributions.length * 26 + namedBodies.length * 14 + realHits.length * 4,
  );

  // ---- Aspect 3: emotional tone --------------------------------------------
  const emotions = found(EMOTION_TERMS, text);
  const emotionScore = Math.max(8, 96 - emotions.length * 22);

  // ---- Aspect 4: urgency / virality bait -----------------------------------
  const urgency = found(URGENCY_TERMS, text);
  const urgencyScore = Math.max(10, 95 - urgency.length * 25);

  // ---- Aspect 5: factual specificity ---------------------------------------
  const numbers = raw.match(/\b\d[\d,.]*\s?(%|percent|crore|lakh|million|billion|kg|km)?/gi) ?? [];
  const dates = raw.match(/\b(\d{1,2}\s)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(\s\d{4})?\b|\b(19|20)\d{2}\b/gi) ?? [];
  const specificity = Math.min(96, 26 + numbers.length * 11 + dates.length * 14);

  // ---- Aspect 6: writing-style integrity -----------------------------------
  const letters = raw.replace(/[^A-Za-z]/g, "");
  const capsRatio = letters ? (raw.match(/[A-Z]/g) ?? []).length / letters.length : 0;
  const bangs = (raw.match(/[!?]{1,}/g) ?? []).length;
  const styleScore = Math.max(
    8,
    Math.round(98 - Math.max(0, capsRatio - 0.12) * 260 - bangs * 12),
  );

  // ---- Aspect 7: clickbait framing -----------------------------------------
  const clickbait = found(CLICKBAIT_PATTERNS, text);
  const clickbaitScore = Math.max(10, 94 - clickbait.length * 30);

  const topics = detectTopics(text);
  const sources = matchSources(topics, seed);

  // ---- Aspect 8: corroboration with official desks --------------------------
  const corroborationBase = namedBodies.length > 0 ? 78 : attributions.length ? 62 : 40;
  const corroboration = Math.min(95, corroborationBase + (topics[0] === "general" ? 0 : 8));

  const aspects: Aspect[] = [
    {
      id: "sensational",
      label: "Sensational vocabulary",
      score: sensational,
      verdict: verdictFor(sensational),
      detail: fakeHits.length
        ? `${fakeHits.length} sensational or unverifiable term${fakeHits.length === 1 ? "" : "s"} detected.`
        : "No obvious sensational or hype vocabulary detected.",
      evidence: fakeHits.sort((a, b) => b.weight - a.weight).slice(0, 6).map((h) => h.term),
    },
    {
      id: "attribution",
      label: "Source attribution",
      score: attributionScore,
      verdict: verdictFor(attributionScore),
      detail: attributions.length || namedBodies.length
        ? "The text attributes claims to a named body or on-record statement."
        : "No named official, document or organisation is cited for the core claim.",
      evidence: [...attributions, ...namedBodies].slice(0, 6),
    },
    {
      id: "emotion",
      label: "Emotional tone",
      score: emotionScore,
      verdict: verdictFor(emotionScore),
      detail: emotions.length
        ? "Emotive framing is used where neutral reporting language would be expected."
        : "Tone reads as broadly neutral and report-like.",
      evidence: emotions.slice(0, 6),
    },
    {
      id: "urgency",
      label: "Urgency & forwarding pressure",
      score: urgencyScore,
      verdict: verdictFor(urgencyScore),
      detail: urgency.length
        ? "Contains pressure to share or act before verification — a common forward-chain marker."
        : "No forwarding pressure or artificial deadline detected.",
      evidence: urgency.slice(0, 6),
    },
    {
      id: "specificity",
      label: "Factual specificity",
      score: specificity,
      verdict: verdictFor(specificity),
      detail: numbers.length || dates.length
        ? `${numbers.length} quantitative reference${numbers.length === 1 ? "" : "s"} and ${dates.length} date marker${dates.length === 1 ? "" : "s"} found — checkable details.`
        : "No dates, figures or checkable specifics — the claim cannot be independently pinned down.",
      evidence: [...numbers.slice(0, 4), ...dates.slice(0, 2)].map((s) => String(s).trim()),
    },
    {
      id: "style",
      label: "Writing-style integrity",
      score: styleScore,
      verdict: verdictFor(styleScore),
      detail:
        capsRatio > 0.2 || bangs > 2
          ? "Heavy capitalisation or repeated exclamation — typical of forwarded misinformation."
          : "Capitalisation and punctuation are within normal editorial range.",
      evidence: [
        `${Math.round(capsRatio * 100)}% uppercase letters`,
        `${bangs} exclamation/question marks`,
      ],
    },
    {
      id: "clickbait",
      label: "Clickbait framing",
      score: clickbaitScore,
      verdict: verdictFor(clickbaitScore),
      detail: clickbait.length
        ? "Uses curiosity-gap headline formulas rather than stating the news."
        : "Headline framing states the claim directly rather than teasing it.",
      evidence: clickbait.slice(0, 4),
    },
    {
      id: "corroboration",
      label: "Official corroboration path",
      score: corroboration,
      verdict: verdictFor(corroboration),
      detail: `${sources.length} official Indian desk${sources.length === 1 ? "" : "s"} publish authoritative data on this topic — listed below for cross-checking.`,
      evidence: sources.map((s) => s.source.shortName),
    },
  ];

  // ---- Overall verdict ------------------------------------------------------
  const aspectAverage = aspects.reduce((sum, a) => sum + a.score, 0) / aspects.length;
  const jitter = (seed % 1000) / 1000;
  const total = fakeScore + realScore;

  let label: PredictionLabel;
  let confidenceScore: number;

  if (total === 0 && aspectAverage > 40 && aspectAverage < 65) {
    label = aspectAverage >= 52 ? "REAL" : "FAKE";
    confidenceScore = 45 + jitter * 18;
  } else {
    const trust = aspectAverage * 0.6 + (realScore - fakeScore) * 1.4 + 20;
    label = trust >= 55 ? "REAL" : "FAKE";
    const distance = Math.abs(trust - 55);
    confidenceScore = 52 + Math.min(distance * 1.35, 42) + (jitter * 5 - 2.5);
  }
  confidenceScore = Math.max(35, Math.min(98.9, confidenceScore));

  // ---- Explanation terms ----------------------------------------------------
  const pool = label === "FAKE" ? fakeHits : realHits;
  let explanation = pool.sort((a, b) => b.weight - a.weight).slice(0, 6).map((h) => h.term);
  if (explanation.length === 0) {
    const counts = new Map<string, number>();
    for (const word of words) {
      if (word.length < 4 || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    explanation = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([w]) => w);
  }
  if (explanation.length === 0) explanation = [words[0] ?? "text"];

  const weakest = [...aspects].sort((a, b) => a.score - b.score)[0]!;
  const strongest = [...aspects].sort((a, b) => b.score - a.score)[0]!;
  const summary =
    label === "FAKE"
      ? `This text shows misinformation markers. The weakest signal is "${weakest.label.toLowerCase()}". Cross-check with the official desks listed before believing or forwarding it.`
      : `This text reads like conventional reporting. The strongest signal is "${strongest.label.toLowerCase()}", but confirm the underlying claim against the official desks listed.`;

  return {
    label,
    confidenceScore: Math.round(confidenceScore * 10) / 10,
    explanation,
    aspects,
    topics,
    sources,
    readingLevelWords: words.length,
    summary,
  };
}

export function confidenceBand(score: number): "strong" | "moderate" | "low" {
  if (score >= 80) return "strong";
  if (score >= LOW_CONFIDENCE_THRESHOLD) return "moderate";
  return "low";
}

export const DISCLAIMER =
  "This assessment is generated automatically by a demonstration model and is not a substitute for professional fact-checking. Always confirm a claim against the official source listed before acting on it.";
