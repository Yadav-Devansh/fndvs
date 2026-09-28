/**
 * Offline builder for the DWM historical-headlines aggregates.
 *
 *   bun run scripts/build-dwm-aggregates.ts --input ./data/india-news-headlines.csv \
 *       --out ./public/data/dwm-aggregates.json --years 5 --sample 10000
 *
 * Streams the file twice (pass 1 finds maxDate, pass 2 scores) using the same
 * pipeline code as the browser worker. Never commit the raw CSV.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  Aggregator,
  DelimitedParser,
  TOI_SOURCE,
  detectDateFormat,
  detectDelimiter,
  guessColumn,
  parseDate,
  windowStartFor,
  type DateFormat,
} from "../src/lib/dwm/pipeline";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const input = arg("input", "./data/india-news-headlines.csv");
const out = arg("out", "./public/data/dwm-aggregates.json");
const years = Number(arg("years", "5"));
const sampleSize = Number(arg("sample", "10000"));

async function readRows(onHeader: (h: string[]) => void, onRow: (r: string[]) => void) {
  let stream: ReadableStream<Uint8Array> = Bun.file(input).stream();
  if (input.endsWith(".gz")) stream = stream.pipeThrough(new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>);
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let parser: DelimitedParser | null = null;
  let header = true;
  const emit = (cells: string[]) => {
    if (header) { header = false; onHeader(cells); return; }
    onRow(cells);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!parser) parser = new DelimitedParser(detectDelimiter(value.split(/\r?\n/)[0] ?? ""));
    parser.push(value, emit);
  }
  parser?.push("", emit, true);
}

let dateCol = -1, catCol = -1, textCol = -1;
let fmt: DateFormat = "YYYYMMDD";
const probe: string[] = [];
let maxYmd = 0;
let t0 = Date.now();

console.log(`Pass 1: finding the latest date in ${input}`);
await readRows(
  (h) => {
    dateCol = guessColumn(h, "date"); catCol = guessColumn(h, "category"); textCol = guessColumn(h, "text");
    if (dateCol < 0 || textCol < 0) throw new Error(`Could not find date/text columns in header: ${h.join(", ")}`);
  },
  (r) => {
    const v = r[dateCol] ?? "";
    if (probe.length < 1000) { probe.push(v); if (probe.length === 1000) fmt = detectDateFormat(probe); return; }
    const d = parseDate(v, fmt);
    if (d !== null && d > maxYmd) maxYmd = d;
  },
);
if (probe.length < 1000) fmt = detectDateFormat(probe);
for (const v of probe) { const d = parseDate(v, fmt); if (d !== null && d > maxYmd) maxYmd = d; }
const startYmd = windowStartFor(maxYmd, years);
console.log(`  date format ${fmt}, window ${startYmd} → ${maxYmd} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

const agg = new Aggregator({
  ...TOI_SOURCE,
  isSynthetic: false,
  windowStartYmd: startYmd,
  windowEndYmd: maxYmd,
  windowYears: years,
  sampleSize,
  processingMode: "All rows in window (offline Bun script)",
});
t0 = Date.now();
console.log("Pass 2: cleaning, scoring and aggregating");
await readRows(
  () => {},
  (r) => {
    agg.add(parseDate(r[dateCol] ?? "", fmt), catCol >= 0 ? (r[catCol] ?? "") : "", r[textCol] ?? "");
    if (agg.rowsRead % 200000 === 0) {
      const s = (Date.now() - t0) / 1000;
      console.log(`  ${agg.rowsRead.toLocaleString("en-IN")} read, ${agg.rowsScored.toLocaleString("en-IN")} scored, ${(agg.rowsRead / s).toFixed(0)} rows/s`);
    }
  },
);
const result = agg.finalize();
mkdirSync(dirname(out), { recursive: true });
const json = JSON.stringify(result);
writeFileSync(out, json);
console.log(`Wrote ${out} (${(json.length / 1e6).toFixed(2)} MB): ${result.meta.rowsScored} scored, ${result.cube.length} cube cells, ${result.sample.length} sample rows`);
console.log("Dropped:", result.meta.dropped);
