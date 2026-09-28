/// <reference lib="webworker" />
/**
 * Background worker: streams, cleans, scores and aggregates large files so
 * the page never freezes. Only aggregates + a reservoir sample are kept.
 */

import { Aggregator, TOI_SOURCE, detectDateFormat, parseDate, windowStartFor, type DateFormat } from "./pipeline";
import { streamRows } from "./reader";
import { generateDemo } from "./demo";
import { mapLabel, validate, type LabelledItem } from "./validation";

export type WorkerIn =
  | {
      type: "headlines";
      file: File;
      cols: { date: number; category: number; text: number };
      dateFormat: DateFormat;
      years: number;
      sampleN: number | null;
    }
  | { type: "labelled"; file: File; cols: { text: number; label: number }; swap: boolean }
  | { type: "demo"; years: number };

export type WorkerOut =
  | { type: "progress"; phase: string; rowsRead: number; rowsScored: number; rps: number; etaSec: number | null; year: number; pct: number }
  | { type: "done"; aggregates: import("./types").DwmAggregates }
  | { type: "labelledDone"; validation: import("./types").LabelledValidation }
  | { type: "error"; message: string };

const post = (m: WorkerOut) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

async function runHeadlines(m: Extract<WorkerIn, { type: "headlines" }>) {
  const { file, cols } = m;
  let fmt = m.dateFormat;
  // Pass 1: dates only → maxDate, count, format.
  const probe: string[] = [];
  let maxYmd = 0;
  let dated = 0;
  let bytes = 0;
  const t0 = performance.now();
  await streamRows(file, () => {}, (r) => {
    const v = r[cols.date] ?? "";
    if (fmt === "AUTO") { probe.push(v); if (probe.length >= 1000) { fmt = detectDateFormat(probe); for (const p of probe) { const d = parseDate(p, fmt); if (d !== null && d > maxYmd) maxYmd = d; } } return; }
    const d = parseDate(v, fmt);
    if (d !== null) { dated++; if (d > maxYmd) maxYmd = d; }
  }, {
    onBytes: (n) => {
      bytes += n;
      if (Math.random() < 0.01) post({ type: "progress", phase: "Pass 1 of 2: finding the latest date", rowsRead: dated, rowsScored: 0, rps: 0, etaSec: null, year: 0, pct: Math.round((bytes / file.size) * 100) });
    },
  });
  if (fmt === "AUTO") { fmt = detectDateFormat(probe); for (const p of probe) { const d = parseDate(p, fmt); if (d !== null && d > maxYmd) maxYmd = d; } }
  if (!maxYmd) throw new Error("No valid dates were found. Check the Date column and the date format.");
  const startYmd = windowStartFor(maxYmd, m.years);

  // Estimate in-window rows from pass-1 share to size the random sample.
  const agg = new Aggregator({
    ...(file.name.toLowerCase().includes("india-news") || file.name.toLowerCase().includes("toi") ? TOI_SOURCE : { datasetId: "uploaded", datasetName: file.name, source: "Uploaded by user" }),
    isSynthetic: false,
    windowStartYmd: startYmd,
    windowEndYmd: maxYmd,
    windowYears: m.years,
    sampleSize: 10000,
    ...(m.sampleN ? { scoreFraction: Math.min(1, m.sampleN / Math.max(1, dated * (m.years / 20))) } : {}),
    processingMode: m.sampleN ? `Random sample of about ${m.sampleN.toLocaleString("en-IN")} rows in window` : "All rows in window",
  });

  bytes = 0;
  const t1 = performance.now();
  let lastPost = 0;
  await streamRows(file, () => {}, (r) => {
    agg.add(parseDate(r[cols.date] ?? "", fmt), cols.category >= 0 ? (r[cols.category] ?? "") : "", r[cols.text] ?? "");
    if (agg.rowsRead - lastPost >= 20000) {
      lastPost = agg.rowsRead;
      const sec = (performance.now() - t1) / 1000;
      const frac = bytes / file.size;
      post({
        type: "progress", phase: "Pass 2 of 2: cleaning, scoring and aggregating",
        rowsRead: agg.rowsRead, rowsScored: agg.rowsScored, rps: Math.round(agg.rowsRead / sec),
        etaSec: frac > 0.01 ? Math.round((sec / frac) * (1 - frac)) : null, year: agg.currentYear, pct: Math.round(frac * 100),
      });
    }
  }, { onBytes: (n) => { bytes += n; } });
  void t0;
  post({ type: "done", aggregates: agg.finalize() });
}

async function runLabelled(m: Extract<WorkerIn, { type: "labelled" }>) {
  const items: LabelledItem[] = [];
  await streamRows(m.file, () => {}, (r) => {
    if (items.length >= 60000) return;
    const text = (r[m.cols.text] ?? "").trim();
    const label = mapLabel(r[m.cols.label] ?? "", m.swap);
    if (text && label) items.push({ text, label });
  });
  if (items.length < 50) throw new Error("Fewer than 50 usable labelled rows were found. Check the text and label columns.");
  post({ type: "progress", phase: `Scoring ${items.length.toLocaleString("en-IN")} labelled items`, rowsRead: items.length, rowsScored: 0, rps: 0, etaSec: null, year: 0, pct: 50 });
  post({ type: "labelledDone", validation: validate(items, m.file.name) });
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  try {
    const m = e.data;
    if (m.type === "headlines") await runHeadlines(m);
    else if (m.type === "labelled") await runLabelled(m);
    else post({ type: "done", aggregates: generateDemo(m.years) });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
