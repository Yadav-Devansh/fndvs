import { describe, expect, it } from "vitest";
import { analyze } from "../detect";
import { decide } from "../evidence/decide";
import { mapRating } from "../evidence/ratings";
import { parseGrounded } from "../evidence/grounded";
import { corroboratingDomains, keyTermsFor, windowDaysFor } from "../evidence/news";
import type { FactCheckRecord, NewsArticle } from "../evidence/types";

const fc = (bucket: FactCheckRecord["ratingBucket"], rating = bucket): FactCheckRecord => ({
  id: "F1", publisher: "PIB Fact Check", url: "https://x", title: "t", rating, ratingBucket: bucket, reviewedAt: null, claimText: "c",
});
const CASH = "The government has quietly decided to ban all cash transactions above Rs 2000 from next month, as per the Ministry of Finance.";
const HOT = "According to a statement by the Ministry of Health, drinking hot water every hour cures covid, officials confirmed on 3 March 2025.";

describe("mapRating", () => {
  it.each([
    ["False", "false"], ["Fake", "false"], ["Pants on Fire", "false"],
    ["Misleading", "misleading"], ["Partly False", "misleading"], ["Missing Context", "misleading"], ["Satire", "misleading"],
    ["True", "true"], ["Mostly True", "true"],
    ["Half True", "mixed"],
    ["False. The video is from 2019.", "false"],
    ["Unproven", "unknown"], ["Banana", "unknown"],
  ])("%s -> %s", (r, b) => expect(mapRating(r)).toBe(b));
});

describe("decide", () => {
  it("a: false fact-check -> likely-misleading", () => expect(decide({ factChecks: [fc("false")] }, "low").verdict).toBe("likely-misleading"));
  it("a: partly false -> likely-misleading", () => expect(decide({ factChecks: [fc("misleading", "Partly False")] }, "low").verdict).toBe("likely-misleading"));
  it("b: true fact-check -> likely-credible", () => expect(decide({ factChecks: [fc("true")] }, "low").verdict).toBe("likely-credible"));
  it("c: two reputable outlets -> likely-credible", () =>
    expect(decide({ factChecks: [], corroboratingDomains: ["thehindu.com", "ndtv.com"] }, "low").verdict).toBe("likely-credible"));
  it("c: one outlet is not enough", () =>
    expect(decide({ factChecks: [], corroboratingDomains: ["thehindu.com"] }, "low").verdict).toBe("unverified"));
  it("c: a mixed fact-check blocks outlet corroboration", () =>
    expect(decide({ factChecks: [fc("mixed")], corroboratingDomains: ["a.com", "b.com"] }, "low").verdict).toBe("unverified"));
  it("d: Gemini alone cannot create credible", () =>
    expect(decide({ factChecks: [], gemini: { verdict: "supported", confidence: 99, reasoning: "r", citedEvidenceIds: ["N1"] } }, "low").verdict).toBe("unverified"));
  it("d: Gemini contradiction downgrades credible to unverified", () =>
    expect(decide({ factChecks: [fc("true")], gemini: { verdict: "contradicted", confidence: 80, reasoning: "r", citedEvidenceIds: ["F1"] } }, "low").verdict).toBe("unverified"));
  it("e: low language risk alone never yields credible", () => expect(decide({ factChecks: [] }, "low").verdict).toBe("unverified"));
  it("f: high language risk alone stays unverified", () => expect(decide({ factChecks: [] }, "high").verdict).toBe("unverified"));
  it("cash-ban and hot-water sentences are unverified without evidence", () => {
    for (const t of [CASH, HOT]) expect(decide({ factChecks: [] }, analyze(t).languageRisk).verdict).toBe("unverified");
  });
});

describe("parseGrounded", () => {
  const ok = JSON.stringify({ verdict: "supported", confidence: 70, reasoning: "Because F1.", citedEvidenceIds: ["F1"] });
  it("accepts citations inside the block", () => expect(parseGrounded(ok, ["F1", "S1"]).ok).toBe(true));
  it("rejects citations not in the block", () => {
    const bad = JSON.stringify({ verdict: "supported", confidence: 70, reasoning: "r", citedEvidenceIds: ["F9"] });
    expect(parseGrounded(bad, ["F1"]).ok).toBe(false);
  });
  it("rejects a non-unverifiable answer with no citations", () => {
    const bad = JSON.stringify({ verdict: "contradicted", confidence: 70, reasoning: "r", citedEvidenceIds: [] });
    expect(parseGrounded(bad, ["F1"]).ok).toBe(false);
  });
  it("falls back to extracting JSON from prose", () => expect(parseGrounded("Here:\n```json\n" + ok + "\n```", ["F1"]).ok).toBe(true));
  it("rejects invalid verdicts", () => expect(parseGrounded('{"verdict":"true","confidence":5,"reasoning":"r","citedEvidenceIds":[]}', []).ok).toBe(false));
});

describe("news corroboration", () => {
  const art = (domain: string, reputable: boolean, matchRatio: number): NewsArticle => ({ id: "N1", title: "t", url: "u", domain, seenAt: null, reputable, matchRatio });
  it("needs distinct reputable domains with >= 60% term overlap", () => {
    expect(corroboratingDomains([art("thehindu.com", true, 0.8), art("ndtv.com", true, 0.5), art("blog.xyz", false, 1)])).toEqual(["thehindu.com"]);
  });
  it("key terms drop stopwords and are deterministic", () => {
    expect(keyTermsFor(CASH)).toEqual(keyTermsFor(CASH));
    expect(keyTermsFor(CASH)).not.toContain("the");
    expect(keyTermsFor(CASH).length).toBeLessThanOrEqual(6);
  });
  it("breaking claims use a 7-day window", () => {
    expect(windowDaysFor("BREAKING: bridge closed")).toBe(7);
    expect(windowDaysFor(CASH)).toBe(90);
  });
});
