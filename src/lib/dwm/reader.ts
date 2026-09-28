/**
 * Streaming file reader for CSV / TSV / .gz / JSON / JSONL. Never calls
 * file.text() on the whole file — reads chunk by chunk.
 */

import { DelimitedParser, detectDelimiter } from "./pipeline";

export type FileKind = "delimited" | "jsonl" | "json" | "parquet" | "unknown";

export function kindOf(name: string): FileKind {
  const n = name.toLowerCase().replace(/\.gz$/, "");
  if (n.endsWith(".parquet")) return "parquet";
  if (n.endsWith(".csv") || n.endsWith(".tsv") || n.endsWith(".txt")) return "delimited";
  if (n.endsWith(".jsonl") || n.endsWith(".ndjson")) return "jsonl";
  if (n.endsWith(".json")) return "json";
  return "unknown";
}

function textStream(file: Blob & { name: string }, onBytes?: (n: number) => void): ReadableStream<string> {
  let s: ReadableStream<Uint8Array> = file.stream();
  if (onBytes) {
    s = s.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) { onBytes(chunk.byteLength); ctl.enqueue(chunk); },
      }),
    );
  }
  if (file.name.toLowerCase().endsWith(".gz")) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unzip .gz files. Unzip it first or use the Bun script.");
    s = s.pipeThrough(new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>);
  }
  return s.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);
}

/**
 * Stream rows. Calls onHeader once, then onRow per record. Return false from
 * shouldContinue() to stop early (preview / cancel).
 */
export async function streamRows(
  file: Blob & { name: string },
  onHeader: (h: string[]) => void,
  onRow: (cells: string[]) => void,
  opts: { onBytes?: (n: number) => void; shouldContinue?: () => boolean } = {},
) {
  const kind = kindOf(file.name);
  if (kind === "parquet") throw new Error("Parquet is not supported in the browser. Convert it to CSV first (e.g. with pandas: pd.read_parquet(f).to_csv('out.csv', index=False)).");
  const reader = textStream(file, opts.onBytes).getReader();
  const go = () => (opts.shouldContinue ? opts.shouldContinue() : true);

  if (kind === "json") {
    // JSON arrays have to be parsed whole; guard size.
    if (file.size > 150_000_000) throw new Error("JSON files over 150 MB cannot be parsed in the browser. Convert to JSONL or CSV.");
    let text = "";
    for (;;) { const { value, done } = await reader.read(); if (done) break; text += value; }
    const arr = JSON.parse(text) as Record<string, unknown>[];
    const keys = Object.keys(arr[0] ?? {});
    onHeader(keys);
    for (const o of arr) { if (!go()) break; onRow(keys.map((k) => String(o[k] ?? ""))); }
    return;
  }

  let keys: string[] | null = null;
  let parser: DelimitedParser | null = null;
  let header = true;
  let lineBuf = "";
  const emitCsv = (cells: string[]) => {
    if (header) { header = false; onHeader(cells.map((c) => c.trim())); return; }
    if (cells.length === 1 && cells[0] === "") return;
    onRow(cells);
  };
  const emitJsonLine = (line: string) => {
    const t = line.trim();
    if (!t) return;
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      if (!keys) { keys = Object.keys(o); onHeader(keys); }
      onRow(keys.map((k) => String(o[k] ?? "")));
    } catch { /* skip malformed line */ }
  };

  for (;;) {
    if (!go()) { await reader.cancel().catch(() => {}); return; }
    const { value, done } = await reader.read();
    if (done) break;
    if (kind === "jsonl") {
      lineBuf += value;
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const l of lines) emitJsonLine(l);
    } else {
      if (!parser) {
        const first = value.split(/\r?\n/)[0] ?? "";
        parser = new DelimitedParser(file.name.toLowerCase().includes(".tsv") ? "\t" : detectDelimiter(first));
      }
      parser.push(value, emitCsv);
    }
  }
  if (kind === "jsonl") emitJsonLine(lineBuf);
  else parser?.push("", emitCsv, true);
}

export async function previewFile(file: Blob & { name: string }, n = 20) {
  let headers: string[] = [];
  const rows: string[][] = [];
  const dates: string[] = [];
  await streamRows(
    file,
    (h) => { headers = h; },
    (r) => { if (rows.length < n) rows.push(r); dates.push(r.join("\u0001")); },
    { shouldContinue: () => dates.length < 1000 },
  );
  return { headers, rows, probeRows: dates.map((d) => d.split("\u0001")) };
}
