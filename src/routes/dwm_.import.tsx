import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SyntheticBanner } from "@/components/dwm/HistoricalViews";
import { DATE_FORMATS, detectDateFormat, guessColumn, type DateFormat } from "@/lib/dwm/pipeline";
import { previewFile, kindOf } from "@/lib/dwm/reader";
import { clearAggregates, downloadJson, isAggregates, loadBundled, loadStoredAggregates, saveAggregates } from "@/lib/dwm/idb";
import { fmtIN } from "@/lib/dwm/analytics";
import type { DwmAggregates } from "@/lib/dwm/types";
import type { WorkerIn, WorkerOut } from "@/lib/dwm/dwm.worker";

export const Route = createFileRoute("/dwm_/import")({
  component: ImportPage,
  head: () => ({
    meta: [
      { title: "Load Headlines Dataset — FNDVS DWM" },
      { name: "description", content: "Stream a large Indian news headlines CSV, clean and score it in the browser, and save the aggregates for the DWM analysis." },
      { property: "og:title", content: "DWM Data Import — FNDVS" },
      { property: "og:description", content: "Load the Times of India headlines dataset or a labelled fake-news set for validation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Preview = { headers: string[]; rows: string[][]; probeRows: string[][] };
type Prog = Extract<WorkerOut, { type: "progress" }>;

function ColSelect({ label, value, headers, onChange, optional }: { label: string; value: number; headers: string[]; onChange: (n: number) => void; optional?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Choose column" /></SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="-1">(none)</SelectItem>}
          {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `column ${i + 1}`}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function PreviewTable({ p }: { p: Preview }) {
  return (
    <div className="mt-3 max-h-56 overflow-auto rounded border border-border">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-muted"><tr>{p.headers.map((h, i) => <th key={i} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
        <tbody>{p.rows.map((r, i) => <tr key={i} className="border-t border-border">{p.headers.map((_, j) => <td key={j} className="max-w-xs truncate px-2 py-0.5">{r[j]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ImportPage() {
  const workerRef = useRef<Worker | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cols, setCols] = useState({ date: -1, category: -1, text: -1 });
  const [fmt, setFmt] = useState<DateFormat>("AUTO");
  const [detected, setDetected] = useState<string>("");
  const [years, setYears] = useState(5);
  const [sampleMode, setSampleMode] = useState(false);
  const [sampleN, setSampleN] = useState(300000);

  const [lFile, setLFile] = useState<File | null>(null);
  const [lPreview, setLPreview] = useState<Preview | null>(null);
  const [lCols, setLCols] = useState({ text: -1, label: -1 });
  const [swap, setSwap] = useState(false);

  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Prog | null>(null);
  const [error, setError] = useState<{ title: string; what: string } | null>(null);
  const [result, setResult] = useState<DwmAggregates | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    loadStoredAggregates().then((a) => a && setResult(a)).catch(() => {});
    return () => workerRef.current?.terminate();
  }, []);

  const fail = (title: string, what: string) => { setError({ title, what }); setBusy(false); };

  async function pick(f: File, labelled: boolean) {
    setError(null);
    if (kindOf(f.name) === "parquet") return fail("Parquet files are not supported here", "Convert it to CSV first, e.g. in Python: pd.read_parquet('file.parquet').to_csv('file.csv', index=False).");
    try {
      const p = await previewFile(f);
      if (!p.headers.length) return fail("The file looks empty", "Check that the first line is a header row.");
      if (labelled) {
        setLFile(f); setLPreview(p);
        setLCols({ text: guessColumn(p.headers, "text"), label: guessColumn(p.headers, "label") });
      } else {
        setFile(f); setPreview(p);
        const c = { date: guessColumn(p.headers, "date"), category: guessColumn(p.headers, "category"), text: guessColumn(p.headers, "text") };
        setCols(c);
        if (c.date >= 0) setDetected(detectDateFormat(p.probeRows.map((r) => r[c.date] ?? "")));
      }
    } catch (e) {
      fail("Could not read the file", e instanceof Error ? e.message : String(e));
    }
  }

  async function persist(a: DwmAggregates) {
    setResult(a);
    try { await saveAggregates(a); setSaveFailed(false); }
    catch { setSaveFailed(true); }
  }

  function run(msg: WorkerIn) {
    workerRef.current?.terminate();
    const w = new Worker(new URL("../lib/dwm/dwm.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    setBusy(true); setError(null); setProg(null);
    w.onmessage = async (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === "progress") setProg(m);
      else if (m.type === "error") { fail("Processing stopped", m.message); w.terminate(); }
      else if (m.type === "done") {
        const prev = result?.labelled;
        await persist(prev && !m.aggregates.labelled ? { ...m.aggregates, labelled: prev } : m.aggregates);
        setBusy(false); w.terminate();
        toast.success("Analysis ready. Open the DWM page to see the inference.");
      } else if (m.type === "labelledDone") {
        const base = result ?? (await loadBundled());
        if (!base) { fail("Load the headlines analysis first", "Validation results are attached to a headlines analysis. Load the bundled results or process a headlines file, then retry."); return; }
        await persist({ ...base, labelled: m.validation });
        setBusy(false); w.terminate();
        toast.success("Validation complete.");
      }
    };
    w.onerror = (e) => { fail("The background worker crashed", `${e.message || "Unknown error"}. Try the random-sample mode or the offline Bun script for very large files.`); w.terminate(); };
    w.postMessage(msg);
  }

  const cancel = () => { workerRef.current?.terminate(); workerRef.current = null; setBusy(false); setProg(null); toast("Cancelled"); };

  const d = result?.meta;
  const funnel = d ? [
    ["Rows read", d.rowsRead], ["Empty / too short", -d.dropped.empty], ["Duplicates", -d.dropped.duplicate],
    ["Bad dates", -d.dropped.badDate], ["Outside window", -d.dropped.outOfWindow], ["Rows kept", d.rowsKept], ["Rows scored", d.rowsScored],
  ] as [string, number][] : [];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <PageHeader eyebrow="DWM · Data import" title="Load the headlines dataset" description="Files are processed entirely in your browser in a background worker. Nothing is uploaded or sent to any AI service."
          action={<Button asChild variant="outline"><Link to="/dwm">Back to analysis</Link></Button>} />

        {result?.meta.isSynthetic && <div className="mt-6"><SyntheticBanner /></div>}
        {error && (
          <Alert variant="destructive" className="mt-6"><AlertTitle>{error.title}</AlertTitle><AlertDescription>What to do: {error.what}</AlertDescription></Alert>
        )}
        {saveFailed && (
          <Alert className="mt-6"><AlertTitle>Could not save in this browser</AlertTitle><AlertDescription>The results are kept for this session only. Download aggregates JSON so you do not lose this.</AlertDescription></Alert>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={async () => { const b = await loadBundled(); if (!b) return fail("No bundled results found", "Upload the dataset below, or build it with bun run dwm:build."); await persist(b); toast.success("Bundled five-year analysis loaded."); }}>Load bundled aggregates</Button>
          <Button variant="outline" disabled={busy} onClick={() => run({ type: "demo", years })}>Load synthetic demo data</Button>
          <label className="inline-flex">
            <input type="file" accept=".json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { const j: unknown = JSON.parse(await f.text()); if (!isAggregates(j)) throw new Error("not an aggregates file"); await persist(j); toast.success("Aggregates loaded."); }
              catch { fail("That is not an FNDVS aggregates file", "Choose a JSON file downloaded from this page or produced by the Bun script."); }
            }} />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-4 text-sm hover:bg-muted">Load aggregates JSON</span>
          </label>
          <Button variant="outline" disabled={!result} onClick={() => result && downloadJson("dwm-aggregates.json", result)}>Download aggregates JSON</Button>
          <Button variant="ghost" disabled={busy} onClick={async () => { if (!confirm("Clear the analysis saved in this browser? The bundled results stay available.")) return; await clearAggregates().catch(() => {}); setResult(null); toast("Saved dataset cleared."); }}>Clear loaded dataset</Button>
        </div>

        {/* Card 1 */}
        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">1. Primary headlines dataset</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Expected: <code>india-news-headlines.csv</code> with columns <code>publish_date</code> (YYYYMMDD), <code>headline_category</code>, <code>headline_text</code>. Download from{" "}
            <a className="underline" href="https://doi.org/10.7910/DVN/DPQMQH" target="_blank" rel="noreferrer">Harvard Dataverse</a> or{" "}
            <a className="underline" href="https://www.kaggle.com/datasets/therohk/india-headlines-news-dataset" target="_blank" rel="noreferrer">Kaggle</a>. Accepts .csv, .csv.gz, .tsv, .json, .jsonl.
          </p>
          <input type="file" className="mt-3 text-sm" accept=".csv,.gz,.tsv,.txt,.json,.jsonl,.parquet" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f, false); }} />
          {file && <p className="mt-2 text-xs text-muted-foreground">{file.name} · {(file.size / 1e6).toFixed(1)} MB</p>}
          {preview && (
            <>
              <PreviewTable p={preview} />
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <ColSelect label="Date column" value={cols.date} headers={preview.headers} onChange={(n) => { setCols({ ...cols, date: n }); setDetected(detectDateFormat(preview.probeRows.map((r) => r[n] ?? ""))); }} />
                <ColSelect label="Category column" value={cols.category} headers={preview.headers} onChange={(n) => setCols({ ...cols, category: n })} optional />
                <ColSelect label="Headline / text column" value={cols.text} headers={preview.headers} onChange={(n) => setCols({ ...cols, text: n })} />
                <div>
                  <Label className="text-xs">Date format {detected && <span className="text-muted-foreground">(detected {detected})</span>}</Label>
                  <Select value={fmt} onValueChange={(v) => setFmt(v as DateFormat)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{DATE_FORMATS.map((f) => <SelectItem key={f} value={f}>{f === "AUTO" ? "Auto-detect" : f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-4" disabled={busy || cols.date < 0 || cols.text < 0} onClick={() => file && run({ type: "headlines", file, cols, dateFormat: fmt, years, sampleN: sampleMode ? sampleN : null })}>
                Process headlines
              </Button>
            </>
          )}
        </section>

        {/* Card 2 */}
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">2. Labelled validation dataset (optional)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A CSV with a text/statement column and a Real/Fake (or 0/1) label, such as IFND (Sharma &amp; Garg, 2021). Used only for the Validation tab.
          </p>
          <input type="file" className="mt-3 text-sm" accept=".csv,.gz,.tsv,.txt,.json,.jsonl" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f, true); }} />
          {lPreview && (
            <>
              <PreviewTable p={lPreview} />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ColSelect label="Text column" value={lCols.text} headers={lPreview.headers} onChange={(n) => setLCols({ ...lCols, text: n })} />
                <ColSelect label="Label column" value={lCols.label} headers={lPreview.headers} onChange={(n) => setLCols({ ...lCols, label: n })} />
                <div className="flex items-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSwap(!swap)}>Swap 0/1</Button>
                  <span className="text-xs text-muted-foreground">{swap ? "1 = REAL, 0 = FAKE" : "1 = FAKE, 0 = REAL"}; text values Real/True and Fake/False are read directly.</span>
                </div>
              </div>
              <Button className="mt-4" disabled={busy || lCols.text < 0 || lCols.label < 0} onClick={() => lFile && run({ type: "labelled", file: lFile, cols: lCols, swap })}>Run validation</Button>
            </>
          )}
        </section>

        {/* Card 3 */}
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">3. Settings</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Time window (counted back from the dataset's latest date)</Label>
              <div className="mt-2 flex gap-2">{[3, 5, 10].map((y) => <Button key={y} size="sm" variant={y === years ? "default" : "outline"} onClick={() => setYears(y)}>{y} years</Button>)}</div>
            </div>
            <div>
              <Label className="text-xs">Processing mode</Label>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant={!sampleMode ? "default" : "outline"} onClick={() => setSampleMode(false)}>All rows in window</Button>
                <Button size="sm" variant={sampleMode ? "default" : "outline"} onClick={() => setSampleMode(true)}>Random sample</Button>
              </div>
              {sampleMode && (
                <div className="mt-3">
                  <Label className="text-xs">Sample size: {fmtIN(sampleN)} rows</Label>
                  <Slider className="mt-2" min={50000} max={2000000} step={50000} value={[sampleN]} onValueChange={([v]) => setSampleN(v ?? 300000)} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Card 4 */}
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">4. Progress and data-quality report</h2>
          {busy && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">{prog?.phase ?? "Starting…"}</p>
              <Progress value={prog?.pct ?? 0} />
              {prog && <p className="text-xs text-muted-foreground">{fmtIN(prog.rowsRead)} rows read · {fmtIN(prog.rowsScored)} scored · {fmtIN(prog.rps)} rows/s{prog.etaSec !== null ? ` · about ${prog.etaSec}s left` : ""}{prog.year ? ` · now in ${prog.year}` : ""}</p>}
              <Button variant="destructive" size="sm" onClick={cancel}>Cancel</Button>
            </div>
          )}
          {!busy && !d && <p className="mt-2 text-sm text-muted-foreground">No dataset loaded. Download the dataset (links above) and upload it here, or load the bundled results.</p>}
          {!busy && d && (
            <div className="mt-3">
              <p className="text-sm">{d.datasetName} · {d.windowStart} → {d.windowEnd} · {d.processingMode}</p>
              <div className="mt-3 space-y-1">
                {funnel.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0">{k}</span>
                    <div className="h-3 rounded bg-primary/70" style={{ width: `${Math.max(1, (Math.abs(v) / Math.max(1, d.rowsRead)) * 100)}%`, opacity: v < 0 ? 0.35 : 1 }} />
                    <span className="shrink-0 tabular-nums">{v < 0 ? "−" : ""}{fmtIN(Math.abs(v))}</span>
                  </div>
                ))}
              </div>
              <ol className="mt-4 list-decimal pl-5 text-xs text-muted-foreground">
                <li>Trim, collapse whitespace, strip HTML tags/entities, normalise quotes.</li>
                <li>Drop empty or shorter than 3 words.</li>
                <li>Drop exact duplicates (case-insensitive, 32-bit hash set).</li>
                <li>Category = first dotted segment, mapped to 10 groups; groups under 0.5% merged into Other.</li>
                <li>Keep only the {d.windowYears}-year window ending at the dataset's latest date.</li>
              </ol>
              {result?.labelled && <p className="mt-2 text-xs">Validation: {result.labelled.datasetName}</p>}
              <Button asChild className="mt-4"><Link to="/dwm">See the final inference</Link></Button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
