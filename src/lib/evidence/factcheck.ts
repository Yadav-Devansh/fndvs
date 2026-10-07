/**
 * Google Fact Check Tools API — claims:search (server-side only).
 * GET https://factchecktools.googleapis.com/v1alpha1/claims:search?query=&key=&languageCode=&pageSize=
 * Response: { claims: [{ text, claimant, claimDate, claimReview: [{ publisher: { name, site },
 *   url, title, reviewDate, textualRating, languageCode }] }] }
 */
import { mapRating } from "./ratings";
import type { FactCheckLookup, FactCheckRecord } from "./types";

const ENDPOINT = "https://factchecktools.googleapis.com/v1alpha1/claims:search";

interface ApiReview {
  publisher?: { name?: string; site?: string };
  url?: string;
  title?: string;
  reviewDate?: string;
  textualRating?: string;
}
interface ApiClaim {
  text?: string;
  claimReview?: ApiReview[];
}

/** ~200 characters, cut at a word boundary. */
export function factCheckQuery(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 200) return flat;
  const cut = flat.slice(0, 200);
  const space = cut.lastIndexOf(" ");
  return space > 120 ? cut.slice(0, space) : cut;
}

export function normaliseClaims(claims: ApiClaim[]): FactCheckRecord[] {
  const out: FactCheckRecord[] = [];
  const seen = new Set<string>();
  for (const c of claims) {
    for (const r of c.claimReview ?? []) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      const rating = (r.textualRating ?? "").trim();
      out.push({
        id: `F${out.length + 1}`,
        publisher: r.publisher?.name || r.publisher?.site || "Unknown publisher",
        url: r.url,
        title: (r.title ?? c.text ?? "").slice(0, 300),
        rating: rating || "No rating given",
        ratingBucket: rating ? mapRating(rating) : "unknown",
        reviewedAt: r.reviewDate ?? null,
        claimText: (c.text ?? "").slice(0, 300),
      });
      if (out.length === 8) return out;
    }
  }
  return out;
}

export async function lookupFactChecks(text: string): Promise<FactCheckLookup> {
  const key = process.env["FACT_CHECK_API_KEY"];
  if (!key) return { status: "not-configured", records: [], message: "Fact-check lookup not configured." };

  const url = `${ENDPOINT}?${new URLSearchParams({ query: factCheckQuery(text), key, pageSize: "10" })}`;

  // 5 second timeout; no retry on 4xx; one retry on 5xx or network failure.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as { claims?: ApiClaim[] };
        return { status: "ok", records: normaliseClaims(data.claims ?? []) };
      }
      if (res.status < 500) {
        console.error("factcheck lookup rejected", res.status);
        return { status: "error", records: [], message: "The fact-check service rejected the request." };
      }
    } catch {
      /* timeout or network — retry once */
    }
  }
  return { status: "error", records: [], message: "The fact-check service didn't answer in time." };
}
