/**
 * The final verdict. Pure and unit-tested. Rules, applied in order:
 *  a. A published fact-check rated false / misleading / partly false -> likely-misleading.
 *  b. A published fact-check rated true -> likely-credible.
 *  c. >= 2 independent reputable outlets report the claim and no fact-check
 *     contradicts it -> likely-credible.
 *  d. Grounded Gemini only moves confidence inside a/b/c. It can never create
 *     "credible"; if it flags a contradiction with the evidence, a credible
 *     outcome is downgraded to unverified.
 *  e. Language signals alone never produce likely-credible.
 *  f. Everything else -> unverified, with what to check next.
 */
import type { LanguageRisk } from "../detect";
import type { Decision, DecisionConfidence, FactCheckRecord, GroundedGemini } from "./types";

export interface DecideEvidence {
  factChecks: FactCheckRecord[];
  corroboratingDomains?: string[];
  gemini?: GroundedGemini | null;
}

const NEXT_STEPS = [
  "Search the official desks listed below for a statement on this exact claim.",
  "Look for the original source: who first said it, where and when.",
  "Check PIB Fact Check and established fact-checkers before sharing.",
];

const lower = (c: DecisionConfidence): DecisionConfidence => (c === "high" ? "medium" : "low");
const raise = (c: DecisionConfidence): DecisionConfidence => (c === "low" ? "medium" : "high");

export function decide(evidence: DecideEvidence, languageRisk: LanguageRisk): Decision {
  const { factChecks, gemini } = evidence;
  const domains = evidence.corroboratingDomains ?? [];
  const negative = factChecks.filter((f) => f.ratingBucket === "false" || f.ratingBucket === "misleading");
  const positive = factChecks.filter((f) => f.ratingBucket === "true");
  const mixed = factChecks.filter((f) => f.ratingBucket === "mixed");
  const languageNote =
    languageRisk === "high"
      ? "The wording also shows high risk signals (tone and pressure only, not facts)."
      : null;

  // a.
  if (negative.length > 0) {
    let confidence: DecisionConfidence = "high";
    const reasons = negative.map((f) => `${f.publisher} rated it “${f.rating}”.`);
    if (positive.length > 0) {
      confidence = lower(confidence);
      reasons.push("Other fact-checks rated a similar claim true — read each review.");
    }
    if (gemini?.verdict === "supported") {
      confidence = lower(confidence);
      reasons.push("The grounded AI read thinks the evidence supports the claim — read the reviews yourself.");
    }
    if (languageNote) reasons.push(languageNote);
    return {
      verdict: "likely-misleading",
      confidence,
      rule: "a",
      headline: "Likely misleading — a published fact-check disputes this claim.",
      reasons,
      nextSteps: ["Open the fact-check linked below and read the full review before sharing."],
    };
  }

  // b. / c.
  const viaFactCheck = positive.length > 0;
  const viaOutlets = !viaFactCheck && domains.length >= 2 && mixed.length === 0;
  if (viaFactCheck || viaOutlets) {
    const reasons = viaFactCheck
      ? positive.map((f) => `${f.publisher} rated it “${f.rating}”.`)
      : [`Reported by ${domains.length} independent reputable outlets: ${domains.join(", ")}.`];
    let confidence: DecisionConfidence = "medium";

    // d.
    if (gemini?.verdict === "contradicted") {
      return {
        verdict: "unverified",
        confidence: "low",
        rule: "f",
        headline: "Unverified — the retrieved evidence conflicts on this claim.",
        reasons: [...reasons, "The grounded AI read found a contradiction within the retrieved evidence."],
        nextSteps: NEXT_STEPS,
      };
    }
    if (gemini?.verdict === "supported") {
      confidence = raise(confidence);
      reasons.push("The grounded AI read agrees the cited evidence supports the claim.");
    }
    return {
      verdict: "likely-credible",
      confidence,
      rule: viaFactCheck ? "b" : "c",
      headline: viaFactCheck
        ? "Likely credible — a published fact-check rates this claim true."
        : "Likely credible — independent reputable outlets report the same claim.",
      reasons,
      nextSteps: ["Open the linked sources to confirm the details match what you received."],
    };
  }

  // e. / f.
  const reasons: string[] = [];
  if (mixed.length) reasons.push(...mixed.map((f) => `${f.publisher} rated it “${f.rating}” — partly true.`));
  if (domains.length === 1) reasons.push(`Only one reputable outlet (${domains[0]}) reported it — two are needed.`);
  if (languageNote) reasons.push(languageNote);
  return {
    verdict: "unverified",
    confidence: "low",
    rule: "f",
    headline: "Unverified — nothing in our sources settles this. Check the official desks below before sharing.",
    reasons,
    nextSteps: NEXT_STEPS,
  };
}
