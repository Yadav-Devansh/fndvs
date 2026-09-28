/**
 * DWM Concept: Association rule mining with Apriori (itemsets up to length 3).
 */

import { ASPECT_IDS } from "./etl";
import type { ScoredHeadline } from "./types";

export interface Rule {
  antecedent: string[];
  consequent: string;
  support: number;
  confidence: number;
  lift: number;
}

export function buildTransactions(rows: ScoredHeadline[], topKeywords: Set<string>): string[][] {
  return rows.slice(0, 20000).map((r) => {
    const t = new Set<string>([`cat=${r.category}`, `year=${r.year}`]);
    for (const k of r.keywords) if (topKeywords.has(k)) t.add(`kw=${k}`);
    for (const id of ASPECT_IDS) if (r.scores[id] < 50) t.add(`aspect_fail=${id}`);
    t.add(r.verdict === 0 ? "risk=1" : "risk=0");
    if (r.confidence < 60) t.add("lowconf=1");
    return [...t].sort();
  });
}

export function apriori(tx: string[][], minSupport = 0.02, minConfidence = 0.6, maxCandidates = 4000): Rule[] {
  const n = tx.length;
  if (!n) return [];
  const minCount = Math.max(1, Math.ceil(minSupport * n));
  const count = new Map<string, number>();
  const txSets = tx.map((t) => new Set(t));

  // L1
  for (const t of tx) for (const i of t) count.set(i, (count.get(i) ?? 0) + 1);
  let prev = [...count].filter(([, c]) => c >= minCount).map(([i]) => [i]);
  const frequent = new Map<string, number>(prev.map((s) => [s.join("\u0001"), count.get(s[0]!)!]));

  for (let k = 2; k <= 3 && prev.length; k++) {
    const cands: string[][] = [];
    const seen = new Set<string>();
    for (let a = 0; a < prev.length && cands.length < maxCandidates; a++)
      for (let b = a + 1; b < prev.length && cands.length < maxCandidates; b++) {
        const A = prev[a]!, B = prev[b]!;
        if (A.slice(0, k - 2).join() !== B.slice(0, k - 2).join()) continue;
        const c = [...A, B[k - 2]!].sort();
        // Two items from the same field (e.g. two years) can never co-occur.
        const fields = new Set(c.map((x) => (x.startsWith("kw=") || x.startsWith("aspect_fail=") ? x : x.split("=")[0])));
        if (fields.size < c.length) continue;
        const key = c.join("\u0001");
        if (seen.has(key)) continue;
        seen.add(key);
        cands.push(c);
      }
    const next: string[][] = [];
    for (const c of cands) {
      let cnt = 0;
      for (const t of txSets) if (c.every((i) => t.has(i))) cnt++;
      if (cnt >= minCount) { next.push(c); frequent.set(c.join("\u0001"), cnt); }
    }
    prev = next;
  }

  const rules: Rule[] = [];
  for (const [key, cnt] of frequent) {
    const items = key.split("\u0001");
    if (items.length < 2) continue;
    for (const consequent of items) {
      const ante = items.filter((i) => i !== consequent);
      const aCnt = frequent.get(ante.join("\u0001"));
      const cCnt = frequent.get(consequent);
      if (!aCnt || !cCnt) continue;
      const confidence = cnt / aCnt;
      if (confidence < minConfidence) continue;
      rules.push({ antecedent: ante, consequent, support: cnt / n, confidence, lift: confidence / (cCnt / n) });
    }
  }
  return rules.sort((a, b) => b.lift - a.lift).slice(0, 200);
}

export function describeItem(i: string): string {
  const [k, v] = i.split("=");
  switch (k) {
    case "cat": return `category is ${v}`;
    case "year": return `year is ${v}`;
    case "kw": return `mentions “${v}”`;
    case "aspect_fail": return `fails ${v}`;
    case "risk": return v === "1" ? "carries a risk signal" : "has no risk signal";
    case "lowconf": return "has low scorer confidence";
    default: return i;
  }
}

export function ruleSentence(r: Rule): string {
  return `Headlines that ${r.antecedent.map(describeItem).join(" and ")} ${describeItem(r.consequent)} ${Math.round(r.confidence * 100)}% of the time (lift ${r.lift.toFixed(2)}, support ${(r.support * 100).toFixed(1)}%).`;
}
