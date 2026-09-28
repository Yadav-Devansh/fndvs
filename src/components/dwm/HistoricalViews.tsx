import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar, BarChart, Brush, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ReferenceDot, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  Activity, AlertTriangle, BarChart3, Boxes, Copy, Download, Gauge, Link2, Network, TrendingUp, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ASPECT_LABELS, ASPECT_SHORT } from "@/lib/dwm/etl";
import { fmtIN, monthlyTrend, r2, rollUp, riskRate } from "@/lib/dwm/analytics";
import { apriori, buildTransactions, ruleSentence } from "@/lib/dwm/apriori";
import { clusterSample, inertia } from "@/lib/dwm/clusters";
import { RISK_FOOTNOTE, inference, markdownReport, type Analysis } from "@/lib/dwm/historical";
import type { DwmAggregates } from "@/lib/dwm/types";

const CLUSTER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)"];
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" };

export function SyntheticBanner() {
  return (
    <div className="rounded-lg border border-caution bg-caution-soft px-4 py-2 text-sm font-semibold text-caution">
      SYNTHETIC DEMO DATA. Not real news. Upload the real dataset on{" "}
      <Link to="/dwm/import" className="underline">/dwm/import</Link>.
    </div>
  );
}

export function Card({ title, caption, children, className = "" }: { title: string; caption?: string | undefined; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function EmptyState({ note }: { note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
      <p className="text-sm text-muted-foreground">{note}</p>
      <Button asChild className="mt-4"><Link to="/dwm/import">Go to data import</Link></Button>
    </div>
  );
}

// ---------------------------------------------------------------- badge

export function DatasetBadge({ agg, source }: { agg: DwmAggregates; source: string | null }) {
  const m = agg.meta;
  const items: [string, string][] = [
    ["Source", m.datasetName],
    ["Window", `${m.windowStart} → ${m.windowEnd}`],
    ["Rows read", fmtIN(m.rowsRead)],
    ["Rows kept", fmtIN(m.rowsKept)],
    ["Rows scored", fmtIN(m.rowsScored)],
    ["Data", m.isSynthetic ? "Synthetic demo" : "Real dataset"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
          <p className={`truncate text-sm font-semibold ${k === "Data" && m.isSynthetic ? "text-caution" : ""}`} title={v}>{v}</p>
        </div>
      ))}
      <p className="col-span-full text-[11px] text-muted-foreground">
        Loaded from {source === "saved" ? "this browser (saved analysis)" : "the bundled results file"} · {m.processingMode} · scorer {m.scorerVersion}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- final inference

const ICONS = { trend: TrendingUp, category: BarChart3, peak: Activity, aspect: AlertTriangle, cluster: Boxes, rule: Link2, confidence: Gauge };

const METHODS: [string, string][] = [
  ["ETL", "Extract rows by streaming the file, transform (clean text, drop empty/duplicate/out-of-window rows, normalise categories) and load into the cube."],
  ["Star schema", "One fact table (each scored headline) linked to Date, Topic (category), Verdict, Source and Dataset dimensions."],
  ["OLAP", "The cube stores sums per (year, month, category), so slice, dice, roll-up and drill-down are exact."],
  ["K-Means", "Groups headlines by their eight credibility aspect scores; the elbow chart and silhouette score justify k."],
  ["Apriori", "Finds item combinations that often occur together, e.g. a category plus a failed aspect → risk signal, ranked by lift."],
  ["Naive Bayes", "A word-probability classifier trained only on the labelled dataset, compared against the rule-based scorer."],
  ["Trend analysis", "Least-squares line through the monthly rate, a moving average, and spikes above mean + 1.5 standard deviations."],
];

export function FinalInference({ agg, a }: { agg: DwmAggregates; a: Analysis }) {
  const inf = inference(agg, a);
  const summary = inf.enough
    ? [inf.headline, "", ...inf.findings.map((f) => `• ${f.title}: ${f.body}`), "", ...inf.readers].join("\n")
    : inf.headline;
  const download = () => {
    const blob = new Blob([markdownReport(agg, a)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = "fndvs-dwm-report.md"; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <section className="rounded-2xl border-2 border-primary/40 bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Final inference</p>
          <h2 className="mt-1 max-w-3xl text-xl font-bold leading-snug sm:text-2xl">{inf.headline}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(summary); toast.success("Summary copied"); }}>
            <Copy className="mr-1 h-4 w-4" /> Copy summary
          </Button>
          <Button size="sm" onClick={download}><Download className="mr-1 h-4 w-4" /> Download report</Button>
        </div>
      </div>
      <p className="mt-3 flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" /> {RISK_FOOTNOTE}
      </p>
      {inf.enough && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {inf.findings.map((f) => {
              const Icon = ICONS[f.icon];
              return (
                <div key={f.title} className="flex gap-3 rounded-lg border border-border p-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{f.title} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{f.value}</span></p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">What this means for readers</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{inf.readers.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Confidence and limits</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{inf.limits.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          </div>
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {METHODS.map(([name, text]) => (
          <Popover key={name}>
            <PopoverTrigger asChild>
              <button className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted">{name}</button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-xs">{text}</PopoverContent>
          </Popover>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- tabs

export function TrendsTab({ agg, a }: { agg: DwmAggregates; a: Analysis }) {
  const [win, setWin] = useState(3);
  const t = useMemo(() => monthlyTrend(agg.cube, win), [agg, win]);
  const events = t.points.filter((p) => p.event);
  return (
    <div className="grid gap-4">
      <Card title="Monthly risk-signal rate" caption={`The rate is ${t.direction}: slope ${r2(t.slope)} pp/month, R² ${r2(t.r2)}. ${t.points.filter((p) => p.spike).length} spike month(s) above mean + 1.5σ are marked in red.`}>
        <div className="mb-3 flex items-center gap-2 text-xs">
          Moving average:
          {[3, 6, 12].map((w) => <Button key={w} size="sm" variant={w === win ? "default" : "outline"} onClick={() => setWin(w)}>{w} months</Button>)}
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={t.points} margin={{ left: 0, right: 10 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="label" fontSize={11} interval={5} />
              <YAxis fontSize={11} unit="%" label={{ value: "Risk-signal rate", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}%`, n]} labelFormatter={(l, p) => { const e = (p?.[0]?.payload as { event?: string } | undefined)?.event; return e ? `${l} · coincides with ${e}` : l; }} />
              <Legend />
              <Line dataKey="rate" name="Monthly risk-signal rate" stroke="var(--primary)" dot={false} strokeWidth={1.5} />
              <Line dataKey="ma" name={`${win}-month moving average`} stroke="var(--chart-2)" dot={false} strokeWidth={2.5} connectNulls />
              {t.points.filter((p) => p.spike).map((p) => <ReferenceDot key={p.key} x={p.label} y={p.rate} r={4} fill="var(--fake)" stroke="none" />)}
              <Brush dataKey="label" height={20} stroke="var(--primary)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {events.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Events inside the window (annotations only; "coincides with", never "caused by")</p>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              {events.map((e) => <li key={e.key}>{e.label}: {e.event} · rate {e.rate}%{e.spike ? " (spike)" : ""}</li>)}
            </ul>
          </div>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="FAKE-style vs REAL-style headlines per year" caption="Stacked counts; the FAKE-style share is the risk-signal rate.">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={a.years}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="year" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v: number) => fmtIN(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtIN(v)} /><Legend />
                <Bar dataKey="risk" name="FAKE-style (risk signal)" stackId="a" fill="var(--fake)" />
                <Bar dataKey="real" name="REAL-style" stackId="a" fill="var(--real)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Year-over-year change" caption="Change is in percentage points (pp), not percent.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Year</th><th>Headlines</th><th>Rate %</th><th>Change (pp)</th><th>Low-conf %</th></tr></thead>
              <tbody>{a.years.map((y) => (
                <tr key={y.year} className="border-t border-border"><td className="py-1.5 font-medium">{y.year}</td><td>{fmtIN(y.total)}</td><td>{y.rate}</td>
                  <td className={y.changePP === null ? "" : y.changePP > 0 ? "text-fake" : "text-real"}>{y.changePP === null ? "–" : `${y.changePP > 0 ? "+" : ""}${y.changePP}`}</td><td>{y.lowConfPct}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Partial years at the window edges have fewer headlines.</p>
        </Card>
      </div>
      <Card title="Top keywords: all vs risk-signal headlines" caption={`“${a.kws.risky[0]?.word ?? "–"}” appears most often among risk-signal headlines.`}>
        <div className="grid gap-4 md:grid-cols-2">
          {([["All headlines", a.kws.all.slice(0, 12), "count", "var(--primary)"], ["Risk-signal headlines", a.kws.risky.slice(0, 12), "risk", "var(--fake)"]] as const).map(([t2, data, key, color]) => (
            <div key={t2} className="h-72">
              <p className="mb-1 text-xs font-medium">{t2}</p>
              <ResponsiveContainer>
                <BarChart data={[...data]} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" fontSize={10} /><YAxis type="category" dataKey="word" fontSize={11} width={80} />
                  <Tooltip contentStyle={tooltipStyle} /><Bar dataKey={key} fill={color} name="Headlines" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function CategoriesTab({ a }: { a: Analysis }) {
  const max = Math.max(0.01, ...a.heat.rows.flatMap((r) => r.values.map((v) => v?.rate ?? 0)));
  const top = a.cats.find((c) => !c.small);
  return (
    <div className="grid gap-4">
      <Card title="Risk-signal rate by category" caption={top ? `${top.category} has the highest risk-signal rate at ${top.rate}%.` : undefined}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={a.cats}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="category" fontSize={11} /><YAxis fontSize={11} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="rate" name="Risk-signal rate">
                {a.cats.map((c) => <Cell key={c.category} fill={c.small ? "var(--muted-foreground)" : "var(--fake)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Category × year heatmap" caption="Cell = risk-signal rate %. Darker = higher. Greyed rows have fewer than 200 headlines.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="p-1 text-left">Category</th>{a.heat.years.map((y) => <th key={y} className="p-1">{y}</th>)}</tr></thead>
            <tbody>
              {a.heat.rows.map((r) => (
                <tr key={r.category}>
                  <td className="p-1 font-medium">{r.category}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className="p-1 text-center" style={{ background: v ? `color-mix(in oklch, var(--fake) ${Math.round((v.rate / max) * 70)}%, transparent)` : undefined, opacity: v && v.total < 200 ? 0.4 : 1 }}>
                      {v ? v.rate : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Share of total volume">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Category</th><th>Headlines</th><th>Share %</th><th>Rate %</th><th>Avg confidence</th></tr></thead>
            <tbody>{a.cats.map((c) => (
              <tr key={c.category} className={`border-t border-border ${c.small ? "opacity-50" : ""}`}>
                <td className="py-1.5 font-medium">{c.category}{c.small && <span className="ml-1 text-[10px]">(small sample)</span>}</td>
                <td>{fmtIN(c.total)}</td><td>{c.share}</td><td>{c.rate}</td><td>{c.avgConf}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AspectsTab({ a }: { a: Analysis }) {
  const radar = a.asp.map((x) => ({ aspect: ASPECT_SHORT[x.id], avg: x.avg }));
  const top3 = [...a.asp].sort((x, y) => y.failRate - x.failRate).slice(0, 3);
  const lines = a.years.map((y) => {
    const row: Record<string, string | number> = { year: y.year };
    for (const t of top3) row[t.aspect] = t.perYear.find((p) => p.year === y.year)?.fail ?? 0;
    return row;
  });
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Aspect profile (average score, whole window)" caption="Higher is more trustworthy on that dimension.">
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radar}>
                <PolarGrid stroke="var(--border)" /><PolarAngleAxis dataKey="aspect" fontSize={11} /><PolarRadiusAxis domain={[0, 100]} fontSize={9} />
                <Radar dataKey="avg" name="Average score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Fail rate per year: top 3 aspects" caption={top3[0] ? `“${top3[0].aspect}” fails most often.` : undefined}>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={lines}>
                <CartesianGrid stroke="var(--border)" /><XAxis dataKey="year" fontSize={11} /><YAxis fontSize={11} unit="%" />
                <Tooltip contentStyle={tooltipStyle} /><Legend />
                {top3.map((t, i) => <Line key={t.id} dataKey={t.aspect} stroke={CLUSTER_COLORS[i]} strokeWidth={2} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card title="Aspect table" caption="Fail = score below 50. Change is first to last year in percentage points.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Aspect</th><th>Avg score</th><th>Fail rate %</th><th>First yr %</th><th>Last yr %</th><th>Change (pp)</th></tr></thead>
            <tbody>{a.asp.map((x) => (
              <tr key={x.id} className="border-t border-border"><td className="py-1.5 font-medium">{x.aspect}</td><td>{x.avg}</td><td>{x.failRate}</td><td>{x.firstFail}</td><td>{x.lastFail}</td><td>{x.changePP > 0 ? "+" : ""}{x.changePP}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ClustersTab({ agg }: { agg: DwmAggregates }) {
  const [k, setK] = useState(3);
  const res = useMemo(() => clusterSample(agg.sample, k), [agg, k]);
  const elbow = useMemo(() => {
    const sub = agg.sample.filter((_, i) => i % 3 === 0);
    return [2, 3, 4, 5, 6].map((kk) => ({ k: kk, inertia: inertia(sub, kk) }));
  }, [agg]);
  const risky = [...res.clusters].sort((x, y) => y.fakePct - x.fakePct)[0];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Clusters (k):
        {[2, 3, 4, 5, 6].map((v) => <Button key={v} size="sm" variant={v === k ? "default" : "outline"} onClick={() => setK(v)}>{v}</Button>)}
        <span className="ml-2 text-xs text-muted-foreground">Silhouette (2,000-row subsample): <b>{res.silhouette}</b> (closer to 1 = better separated)</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Elbow chart" caption="Inertia drops as k grows; the bend suggests a sensible k.">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={elbow}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="k" fontSize={11} /><YAxis fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="inertia" stroke="var(--primary)" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={`Scatter: ${ASPECT_LABELS[res.axes[0]]} vs ${ASPECT_LABELS[res.axes[1]]}`} caption="The two aspects with the highest variance; colour = cluster.">
          <div className="h-64">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="var(--border)" />
                <XAxis type="number" dataKey="x" name={ASPECT_SHORT[res.axes[0]]} domain={[0, 100]} fontSize={11} />
                <YAxis type="number" dataKey="y" name={ASPECT_SHORT[res.axes[1]]} domain={[0, 100]} fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                {res.clusters.map((c, i) => (
                  <Scatter key={c.clusterId} name={c.label} data={res.points.filter((p) => p.c === c.clusterId)} fill={CLUSTER_COLORS[i % 6]} fillOpacity={0.5} />
                ))}
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card title="Cluster profiles" caption={risky ? `“${risky.label}” is the highest-risk cluster at ${risky.fakePct}% risk-signal.` : undefined}>
        <div className="grid gap-3 md:grid-cols-3">
          {res.clusters.map((c, i) => (
            <div key={c.clusterId} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold" style={{ color: CLUSTER_COLORS[i % 6] }}>{c.label}</p>
              <p className="mt-1 text-muted-foreground">{fmtIN(c.size)} headlines · {c.fakePct}% risk-signal · avg confidence {c.avgConfidence}</p>
              <p className="mt-1 text-xs text-muted-foreground">Top categories: {c.topCategories.join(", ")}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function RulesTab({ agg, a }: { agg: DwmAggregates; a: Analysis }) {
  const [sup, setSup] = useState(2);
  const [conf, setConf] = useState(60);
  const [onlyRisk, setOnlyRisk] = useState(true);
  const rules = useMemo(() => {
    const tx = buildTransactions(agg.sample, new Set(a.kws.all.map((w) => w.word)));
    return apriori(tx, sup / 100, conf / 100);
  }, [agg, a, sup, conf]);
  const shown = (onlyRisk ? rules.filter((r) => r.consequent === "risk=1") : rules).slice(0, 50);
  return (
    <div className="grid gap-4">
      <Card title="Association rules (Apriori)" caption="Mined from the stratified sample. Items: category, year, top keywords, failed aspects, risk signal, low confidence.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label className="text-xs">Min support: {sup}%</Label><Slider className="mt-2" min={0.5} max={20} step={0.5} value={[sup]} onValueChange={([v]) => setSup(v ?? 2)} /></div>
          <div><Label className="text-xs">Min confidence: {conf}%</Label><Slider className="mt-2" min={10} max={95} step={5} value={[conf]} onValueChange={([v]) => setConf(v ?? 60)} /></div>
          <div className="flex items-end gap-2">
            <Button size="sm" variant={onlyRisk ? "default" : "outline"} onClick={() => setOnlyRisk(!onlyRisk)}>{onlyRisk ? "Showing rules → risk=1" : "Showing all rules"}</Button>
            <Popover>
              <PopoverTrigger asChild><Button size="icon" variant="ghost" aria-label="What do these mean"><Info className="h-4 w-4" /></Button></PopoverTrigger>
              <PopoverContent className="w-72 text-xs space-y-1">
                <p><b>Support</b>: share of all headlines containing A and B.</p>
                <p><b>Confidence</b>: of headlines with A, the share that also have B.</p>
                <p><b>Lift</b>: confidence ÷ how common B is overall. Above 1 means A makes B more likely.</p>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No rules meet these thresholds{onlyRisk ? " with risk=1 as the consequent. Risk signals are rare in headlines, so lower min support and confidence" : ""}.</p>
        ) : (
          <>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">{shown.slice(0, 3).map((r) => <li key={r.antecedent.join() + r.consequent}>{ruleSentence(r)}</li>)}</ul>
            <div className="mt-4 max-h-96 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-left text-muted-foreground"><tr><th className="py-1">A ⇒ B</th><th>Support</th><th>Confidence</th><th>Lift</th></tr></thead>
                <tbody>{shown.map((r) => (
                  <tr key={r.antecedent.join() + r.consequent} className="border-t border-border">
                    <td className="py-1 font-mono">{r.antecedent.join(" + ")} ⇒ {r.consequent}</td>
                    <td>{(r.support * 100).toFixed(1)}%</td><td>{(r.confidence * 100).toFixed(0)}%</td><td>{r.lift.toFixed(2)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export function ValidationTab({ agg }: { agg: DwmAggregates }) {
  const v = agg.labelled;
  if (!v) return <EmptyState note="No labelled dataset loaded. Upload a labelled CSV (e.g. IFND, with text and Real/Fake label columns) under “Labelled validation dataset” on the import page. No numbers are shown until then." />;
  const beats = v.ruleBased.accuracy - v.baselineAccuracy;
  const rows: [string, string, string, string][] = [
    ["Accuracy %", String(v.ruleBased.accuracy), String(v.naiveBayes.accuracy), String(v.baselineAccuracy)],
    ["Precision (FAKE) %", String(v.ruleBased.precision), String(v.naiveBayes.precision), "–"],
    ["Recall (FAKE) %", String(v.ruleBased.recall), String(v.naiveBayes.recall), "–"],
    ["F1 (FAKE) %", String(v.ruleBased.f1), String(v.naiveBayes.f1), "–"],
  ];
  const cm = (m: typeof v.ruleBased, t: string) => (
    <div>
      <p className="mb-1 text-xs font-medium">{t}</p>
      <table className="text-xs">
        <thead><tr><th /><th className="px-2">Pred FAKE</th><th className="px-2">Pred REAL</th></tr></thead>
        <tbody>
          <tr><th className="pr-2 text-left">True FAKE</th><td className="bg-real-soft px-2 text-center">{fmtIN(m.confusion.tp)}</td><td className="bg-fake-soft px-2 text-center">{fmtIN(m.confusion.fn)}</td></tr>
          <tr><th className="pr-2 text-left">True REAL</th><td className="bg-fake-soft px-2 text-center">{fmtIN(m.confusion.fp)}</td><td className="bg-real-soft px-2 text-center">{fmtIN(m.confusion.tn)}</td></tr>
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="grid gap-4">
      <Card title={`Validation on ${v.datasetName}`} caption={`${fmtIN(v.total)} labelled items (${fmtIN(v.fakeCount)} FAKE, ${fmtIN(v.realCount)} REAL). Cut-off ${v.threshold} chosen on the 70% train split (${fmtIN(v.trainSize)}); metrics below are on the 30% test split (${fmtIN(v.testSize)}) only.`}>
        <p className="text-sm font-medium">
          The rule-based scorer {beats > 0 ? "beats" : "does not beat"} the majority baseline (always “{v.baselineLabel}”) by {Math.abs(r2(beats))} points. The data is class-imbalanced, so accuracy alone is misleading; look at F1.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Metric</th><th>Rule-based scorer</th><th>Naive Bayes</th><th>Majority baseline</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-border">{r.map((c, i) => <td key={i} className={`py-1.5 ${i === 0 ? "font-medium" : ""}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">{cm(v.ruleBased, "Rule-based scorer")}{cm(v.naiveBayes, "Naive Bayes")}</div>
        <ul className="mt-4 list-disc pl-5 text-xs text-muted-foreground">
          <li>IFND's Fake class is partly generated by an augmentation algorithm.</li>
          <li>Labelled items are statements; the main dataset is headlines.</li>
          <li>English only; the scorer is rule-based (style signals, not truth).</li>
        </ul>
      </Card>
    </div>
  );
}

export function WarehouseTab({ agg }: { agg: DwmAggregates }) {
  const [year, setYear] = useState<string>("ALL");
  const years = [...new Set(agg.cube.map((c) => c.year))].sort();
  const cube = year === "ALL" ? agg.cube : agg.cube.filter((c) => String(c.year) === year);
  const quarters = rollUp(cube, "quarter");
  const all = rollUp(agg.cube, "all")[0];
  const kws = year === "ALL" ? [] : (agg.keywordsByYear[year] ?? []).slice(0, 10);
  const schema: [string, string[]][] = [
    ["Fact_Verification", ["verification_id", "date_id → Dim_Date", "topic_id → Dim_Topic", "verdict_id → Dim_Verdict", "source_id → Dim_Source", "dataset_id → Dim_Dataset", "confidence, 8 aspect scores"]],
    ["Dim_Date", ["date", "day", "month", "quarter", "year"]],
    ["Dim_Topic", [`category (${new Set(agg.cube.map((c) => c.category)).size} values)`]],
    ["Dim_Verdict", ["0 = FAKE-style (risk signal)", "1 = REAL-style"]],
    ["Dim_Source", ["publisher (Times of India)"]],
    ["Dim_Dataset", [agg.meta.datasetId, agg.meta.isSynthetic ? "synthetic" : "real", `${agg.meta.windowStart} → ${agg.meta.windowEnd}`]],
  ];
  return (
    <div className="grid gap-4">
      <Card title="Star schema" caption={`Historical facts are stored as ${fmtIN(agg.cube.length)} pre-aggregated cube cells plus a ${fmtIN(agg.sample.length)}-row sample.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schema.map(([t, rows]) => (
            <div key={t} className={`rounded-lg border p-3 ${t.startsWith("Fact") ? "border-primary" : "border-border"}`}>
              <p className="font-mono text-sm font-semibold">{t}</p>
              <ul className="mt-1 text-xs text-muted-foreground">{rows.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
      <Card title="OLAP: slice → roll-up → drill-down" caption="Pick a year to slice, see quarters (roll-up of months) and drill down to top keywords.">
        <div className="flex flex-wrap gap-2">
          {["ALL", ...years.map(String)].map((y) => <Button key={y} size="sm" variant={y === year ? "default" : "outline"} onClick={() => setYear(y)}>{y === "ALL" ? "All years" : y}</Button>)}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Quarter</th><th>Headlines</th><th>Risk-signal</th><th>Rate %</th></tr></thead>
            <tbody>{quarters.map((q) => <tr key={q.key} className="border-t border-border"><td className="py-1.5">{q.key}</td><td>{fmtIN(q.total)}</td><td>{fmtIN(q.risk)}</td><td>{r2(riskRate(q))}</td></tr>)}</tbody>
          </table>
        </div>
        {kws.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Drill-down, top keywords in {year}: {kws.map((k) => `${k.word} (${fmtIN(k.count)})`).join(", ")}</p>}
        <p className="mt-3 text-xs text-muted-foreground">Roll-up check: sum of all cube cells = {fmtIN(all?.total ?? 0)} = rows scored ({fmtIN(agg.meta.rowsScored)}) {all?.total === agg.meta.rowsScored ? "✓" : "✗"}</p>
      </Card>
    </div>
  );
}

export { Network };
