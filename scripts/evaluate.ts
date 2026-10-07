/** Offline evaluation of the rule engine only (no network). Run: bun run eval */
import { readFileSync } from "node:fs";
import { analyze } from "../src/lib/detect";

type Label = "false" | "true" | "unverifiable";
const LABELS: Label[] = ["false", "true", "unverifiable"];
const rows = readFileSync(new URL("../eval/claims.jsonl", import.meta.url), "utf8")
  .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as { text: string; label: string });
const usable = rows.filter((r) => LABELS.includes(r.label as Label) && r.text !== "TODO");
console.log(`rows: ${rows.length}, labelled: ${usable.length}, TODO: ${rows.length - usable.length}\n`);

// The engine can only say "likely-misleading" (-> false) or "unverified" (-> unverifiable); it never says true.
const toLabel = (v: string): Label => (v === "likely-misleading" ? "false" : "unverifiable");
const m: Record<Label, Record<Label, number>> = Object.fromEntries(
  LABELS.map((a) => [a, Object.fromEntries(LABELS.map((b) => [b, 0]))])) as never;
for (const r of usable) m[r.label as Label][toLabel(analyze(r.text).verdict)]++;

console.log("confusion matrix (rows = actual, cols = predicted)");
console.log("actual\\pred".padEnd(14) + LABELS.map((l) => l.padStart(14)).join(""));
for (const a of LABELS) console.log(a.padEnd(14) + LABELS.map((p) => String(m[a][p]).padStart(14)).join(""));

const pct = (n: number, d: number) => (d ? (n / d * 100).toFixed(1) + "%" : "n/a");
console.log("\nper class         precision    recall   support");
for (const c of LABELS) {
  const tp = m[c][c], pred = LABELS.reduce((s, a) => s + m[a][c], 0), sup = LABELS.reduce((s, p) => s + m[c][p], 0);
  console.log(c.padEnd(16) + pct(tp, pred).padStart(11) + pct(tp, sup).padStart(10) + String(sup).padStart(10));
}
const correct = LABELS.reduce((s, c) => s + m[c][c], 0);
const counts = LABELS.map((c) => [c, usable.filter((r) => r.label === c).length] as const).sort((a, b) => b[1] - a[1]);
console.log(`\nengine accuracy: ${pct(correct, usable.length)}`);
console.log(`majority-class baseline (always "${counts[0]![0]}"): ${pct(counts[0]![1], usable.length)}`);
