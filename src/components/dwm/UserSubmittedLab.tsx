import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Disclaimer } from "@/components/PredictionUI";
import { useRecords } from "@/routes/history";
import {
  ASPECT_IDS,
  ASPECT_LABELS,
  ASPECT_SHORT,
  buildWarehouse,
  topicName,
  verdictName,
} from "@/lib/dwm/etl";
import {
  EMPTY_FILTERS,
  applyFilters,
  aspectProfile,
  bandDistribution,
  byTime,
  byTopic,
  byVerdictConfidence,
  round1,
  type OlapFilters,
  type TimeGrain,
} from "@/lib/dwm/olap";
import { kmeans } from "@/lib/dwm/kmeans";
import { discoverInsights } from "@/lib/dwm/insights";
import { downloadCsv, toCsv } from "@/lib/dwm/export";

const PAGE_SIZE = 8;

function ConceptTag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

function Section({
  id,
  concept,
  title,
  description,
  children,
  action,
}: {
  id: string;
  concept: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <ConceptTag>{`DWM Concept: ${concept}`}</ConceptTag>
          <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "fake" | "real" | "caution" }) {
  const color =
    tone === "fake" ? "text-fake" : tone === "real" ? "text-real" : tone === "caution" ? "text-caution" : "text-foreground";
  return (
    <div className="surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Empty({ note }: { note: string }) {
  return (
    <div className="surface flex h-56 items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {note}
    </div>
  );
}

export function UserSubmittedLab() {
  const records = useRecords();
  const wh = useMemo(() => buildWarehouse(records), [records]);

  const [filters, setFilters] = useState<OlapFilters>(EMPTY_FILTERS);
  const [grain, setGrain] = useState<TimeGrain>("month");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const facts = useMemo(() => applyFilters(wh, filters), [wh, filters]);
  const topics = useMemo(() => byTopic(wh, facts), [wh, facts]);
  const timeRows = useMemo(() => byTime(wh, facts, grain), [wh, facts, grain]);
  const aspects = useMemo(() => aspectProfile(facts, ASPECT_LABELS), [facts]);
  const bands = useMemo(() => bandDistribution(facts), [facts]);
  const verdictConf = useMemo(() => byVerdictConfidence(facts), [facts]);
  const km = useMemo(() => kmeans(facts, 3), [facts]);
  const insights = useMemo(() => discoverInsights(wh, facts, km.clusters), [wh, facts, km.clusters]);

  const years = useMemo(
    () => [...new Set(wh.dimDate.map((d) => d.year))].sort().map(String),
    [wh],
  );
  const months = useMemo(
    () =>
      [...new Map(wh.dimDate.map((d) => [d.month, d.monthName])).entries()].sort(
        (a, b) => a[0] - b[0],
      ),
    [wh],
  );

  const fakeCount = facts.filter((f) => f.verdict_id === 0).length;
  const pieData = [
    { name: "Likely fake", value: fakeCount, fill: "var(--fake)" },
    { name: "Likely genuine", value: facts.length - fakeCount, fill: "var(--real)" },
  ];

  // Colour follows measured credibility rank, not the arbitrary cluster index.
  const clusterColors = ["var(--real)", "var(--caution)", "var(--fake)"];
  const rankById = new Map(
    [...km.clusters].sort((a, b) => b.overallScore - a.overallScore).map((c, i) => [c.clusterId, i]),
  );
  const clusterColor = (id: number) =>
    clusterColors[(rankById.get(id) ?? 0) % clusterColors.length];

  const scatterData = facts.map((f) => ({
    x: f.scores.sensational,
    y: f.scores.attribution,
    cluster: km.assignments.get(f.verification_id) ?? 0,
  }));

  const tableRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return facts.filter((f) => !needle || f.text.toLowerCase().includes(needle));
  }, [facts, q]);
  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = tableRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const setFilter = (k: keyof OlapFilters, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }));
    setPage(0);
  };

  const hasData = wh.facts.length > 0;

  return (
    <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="text-sm text-muted-foreground">User-submitted claims (n = {wh.facts.length.toLocaleString("en-IN")}), kept separate from the historical headlines.</p>
          {
            <Button
              variant="outline"
              disabled={!hasData}
              onClick={() => downloadCsv("fndvs_warehouse.csv", toCsv(wh, facts))}
            >
              Export analytical data (CSV)
            </Button>
          }
        </div>

        {/* ---------- Overview ---------- */}
        <div className="mt-8 grid gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="surface p-6">
            <ConceptTag>DWM Concept: Overview</ConceptTag>
            <h2 className="mt-2 font-display text-xl font-bold">About this module</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This section reuses the verification records produced by FNDVS — verdicts, confidence
              scores, eight credibility aspects, detected topics and matched official sources — and
              runs a full data-warehousing pipeline over them: extraction, cleaning, transformation,
              loading into a star schema, OLAP analysis and K-Means clustering. The detection engine
              itself is untouched; this is a read-only analytical layer.
            </p>
          </div>
          <div className="surface p-6">
            <p className="eyebrow">DWM concepts used</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {[
                "ETL",
                "Data cleaning",
                "Data warehouse",
                "Star schema",
                "OLAP",
                "Roll-up",
                "Drill-down",
                "Slice",
                "Dice",
                "K-Means clustering",
                "Data visualization",
              ].map((c) => (
                <li key={c} className="flex items-start gap-1.5">
                  <span className="text-real">✓</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {!hasData && (
          <div className="surface mt-6 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              The warehouse is empty because no verification records exist in this browser yet.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/submit">Verify a claim to populate the warehouse</Link>
            </Button>
          </div>
        )}

        {/* ---------- ETL ---------- */}
        <Section
          id="etl"
          concept="ETL"
          title="ETL pipeline"
          description="How raw verification records become analysable warehouse rows."
        >
          <div className="grid gap-3 lg:grid-cols-6">
            {[
              { k: "Source data", v: "FNDVS verification records held in this browser." },
              { k: "Extract", v: "Read every stored record, including legacy or partial entries." },
              {
                k: "Transform",
                v: "Drop duplicates, impute missing values, normalise topic and verdict names, split timestamps into day/month/year, and band confidence (Strong ≥80, Moderate 60–79, Low <60).",
              },
              { k: "Load", v: "Populate an in-memory fact table and four dimension tables." },
              { k: "Data warehouse", v: "Fact_Verification joined to Dim_Date, Dim_Topic, Dim_Verdict, Dim_Source." },
              { k: "OLAP + mining", v: "Slice/dice, roll-up/drill-down, charts and K-Means." },
            ].map((s, i) => (
              <div key={s.k} className="surface relative p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Stage {i + 1}
                </span>
                <p className="mt-1 font-display text-sm font-bold uppercase tracking-wide">{s.k}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- Star schema ---------- */}
        <Section
          id="schema"
          concept="Star Schema"
          title="Analytical Data Warehouse — Star Schema"
          description="One central fact table surrounded by conformed dimensions."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <SchemaCard
              title="Dim_Date"
              rows={["date_id (PK)", "date", "day", "month", "year"]}
              count={wh.dimDate.length}
            />
            <div className="surface border-primary/40 p-4 lg:row-span-2">
              <p className="eyebrow text-primary">Fact table</p>
              <p className="mt-1 font-display text-base font-bold">Fact_Verification</p>
              <ul className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
                {[
                  "verification_id (PK)",
                  "date_id (FK)",
                  "topic_id (FK)",
                  "verdict_id (FK)",
                  "source_id (FK)",
                  "confidence_score",
                  ...ASPECT_IDS.map((a) => `${a}_score`),
                ].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold text-foreground">
                {wh.facts.length} fact rows loaded
              </p>
            </div>
            <SchemaCard
              title="Dim_Topic"
              rows={["topic_id (PK)", "topic_name"]}
              count={wh.dimTopic.length}
            />
            <SchemaCard
              title="Dim_Verdict"
              rows={["verdict_id (PK)", "verdict_name"]}
              count={wh.dimVerdict.length}
            />
            <SchemaCard
              title="Dim_Source"
              rows={["source_id (PK)", "source_name", "source_category"]}
              count={wh.dimSource.length}
            />
          </div>
        </Section>

        {/* ---------- Pipeline stats ---------- */}
        <Section
          id="stats"
          concept="Data Warehouse"
          title="Warehouse statistics"
          description="Every figure is computed from the live record set."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total raw records" value={String(wh.stats.rawRecords)} />
            <Stat label="Total clean records" value={String(wh.stats.cleanRecords)} />
            <Stat label="Duplicates removed" value={String(wh.stats.duplicatesRemoved)} tone="caution" />
            <Stat label="Missing values handled" value={String(wh.stats.missingValuesHandled)} tone="caution" />
            <Stat label="Warehouse records" value={String(wh.stats.warehouseRecords)} />
            <Stat label="Distinct topics" value={String(wh.stats.topics)} />
            <Stat label="Fake claims" value={String(wh.stats.fakeClaims)} tone="fake" />
            <Stat label="Real claims" value={String(wh.stats.realClaims)} tone="real" />
          </div>
        </Section>

        {/* ---------- OLAP filters ---------- */}
        <Section
          id="olap"
          concept="OLAP"
          title="OLAP analytics"
          description="Slice and dice the cube across time, topic, verdict and confidence band. Every chart below respects these filters."
        >
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect
              id="f-topic"
              label="Topic"
              value={filters.topic}
              onChange={(v) => setFilter("topic", v)}
              options={[["ALL", "All topics"], ...wh.dimTopic.map((t) => [t.topic_name, t.topic_name] as [string, string])]}
            />
            <FilterSelect
              id="f-verdict"
              label="Verdict (slice)"
              value={filters.verdict}
              onChange={(v) => setFilter("verdict", v)}
              options={[["ALL", "All verdicts"], ["FAKE", "Likely fake"], ["REAL", "Likely genuine"]]}
            />
            <FilterSelect
              id="f-year"
              label="Year"
              value={filters.year}
              onChange={(v) => setFilter("year", v)}
              options={[["ALL", "All years"], ...years.map((y) => [y, y] as [string, string])]}
            />
            <FilterSelect
              id="f-month"
              label="Month"
              value={filters.month}
              onChange={(v) => setFilter("month", v)}
              options={[["ALL", "All months"], ...months.map(([n, name]) => [String(n), name] as [string, string])]}
            />
            <FilterSelect
              id="f-band"
              label="Confidence band"
              value={filters.band}
              onChange={(v) => setFilter("band", v)}
              options={[["ALL", "All bands"], ["Strong", "Strong (≥80)"], ["Moderate", "Moderate (60–79)"], ["Low", "Low (<60)"]]}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Cube selection: <strong className="text-foreground">{facts.length}</strong> of {wh.facts.length} fact rows
            </p>
            <Button size="sm" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              Reset cube
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFilters({ ...EMPTY_FILTERS, verdict: "FAKE" })}>
              Slice: FAKE only
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!wh.dimTopic.length}
              onClick={() =>
                setFilters({
                  ...EMPTY_FILTERS,
                  verdict: "FAKE",
                  topic: wh.dimTopic[0]?.topic_name ?? "ALL",
                  month: String(wh.dimDate[0]?.month ?? "ALL"),
                })
              }
            >
              Dice: FAKE × first topic × first month
            </Button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <OlapCard
              title="Roll-up"
              body="Aggregate detail upward: Day → Month → Year. Switch the time grain in the trend chart to roll up."
              active={grain === "year"}
              onClick={() => setGrain("year")}
              cta="Roll up to year"
            />
            <OlapCard
              title="Drill-down"
              body="Move to finer granularity: Year → Month → Day, exposing individual verification dates."
              active={grain === "day"}
              onClick={() => setGrain("day")}
              cta="Drill down to day"
            />
            <OlapCard
              title="Slice"
              body="Fix a single dimension value — for example, view only FAKE claims across all other dimensions."
              active={filters.verdict === "FAKE" && filters.topic === "ALL"}
              onClick={() => setFilters({ ...EMPTY_FILTERS, verdict: "FAKE" })}
              cta="Slice FAKE"
            />
            <OlapCard
              title="Dice"
              body="Constrain several dimensions at once — a chosen topic and month, restricted to FAKE verdicts."
              active={filters.verdict !== "ALL" && filters.topic !== "ALL"}
              onClick={() =>
                setFilters({
                  ...EMPTY_FILTERS,
                  verdict: "FAKE",
                  topic: wh.dimTopic[0]?.topic_name ?? "ALL",
                })
              }
              cta="Dice sample"
            />
          </div>
        </Section>

        {/* ---------- Dashboard ---------- */}
        <Section
          id="charts"
          concept="Data Visualization"
          title="Analytics dashboard"
          description="Fake-vs-real distribution, topic analysis, trend over time, confidence analysis and aspect analysis."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Fake vs real distribution" subtitle="Share of verdicts in the current cube">
              {facts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No records match the current cube selection." />
              )}
            </ChartCard>

            <ChartCard title="Fake vs real by topic" subtitle="Claim count per subject area">
              {topics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topics} margin={{ bottom: 20 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="topic" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Claims", angle: -90, position: "insideLeft", fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="fake" name="Fake" stackId="a" fill="var(--fake)" />
                    <Bar dataKey="real" name="Real" stackId="a" fill="var(--real)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No topic rows in the current cube." />
              )}
            </ChartCard>

            <ChartCard
              title={`Verification trend by ${grain}`}
              subtitle="Roll-up / drill-down across the time dimension"
            >
              {timeRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeRows} margin={{ bottom: 20 }}>
                    <CartesianGrid stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Claims", angle: -90, position: "insideLeft", fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="All claims" stroke="var(--primary)" strokeWidth={2} />
                    <Line type="monotone" dataKey="fake" name="Fake" stroke="var(--fake)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No time periods in the current cube." />
              )}
            </ChartCard>

            <ChartCard title="Average confidence by topic" subtitle="Mean confidence score (0–100)">
              {topics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topics} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="topic" width={120} tick={{ fontSize: 11 }} interval={0} />
                    <Tooltip />
                    <Bar dataKey="avgConfidence" name="Avg confidence %" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No topic rows in the current cube." />
              )}
            </ChartCard>

            <ChartCard title="Eight credibility aspects" subtitle="Mean score per aspect, fake vs real">
              {facts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={aspects.map((a) => ({ ...a, short: ASPECT_SHORT[a.id] }))}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="short" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Fake" dataKey="fakeAvg" stroke="var(--fake)" fill="var(--fake)" fillOpacity={0.25} />
                    <Radar name="Real" dataKey="realAvg" stroke="var(--real)" fill="var(--real)" fillOpacity={0.25} />
                    <Tooltip />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No aspect data in the current cube." />
              )}
            </ChartCard>

            <ChartCard title="Most frequently failing aspects" subtitle="Share of records scoring below 45">
              {facts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...aspects].sort((a, b) => b.failRate - a.failRate)}
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="aspect" width={150} tick={{ fontSize: 10 }} interval={0} />
                    <Tooltip />
                    <Bar dataKey="failRate" name="Fail rate %" fill="var(--caution)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No aspect data in the current cube." />
              )}
            </ChartCard>

            <ChartCard title="Confidence bands" subtitle="Strong ≥80 · Moderate 60–79 · Low <60">
              {facts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bands}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Records", angle: -90, position: "insideLeft", fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Records" radius={[4, 4, 0, 0]}>
                      {bands.map((b) => (
                        <Cell
                          key={b.band}
                          fill={b.band === "Strong" ? "var(--real)" : b.band === "Moderate" ? "var(--caution)" : "var(--fake)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No records in the current cube." />
              )}
            </ChartCard>

            <ChartCard title="Average confidence by verdict" subtitle="Measure: AVG(confidence_score)">
              {facts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={verdictConf}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="verdict" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="avgConfidence" name="Avg confidence %" radius={[4, 4, 0, 0]}>
                      {verdictConf.map((v) => (
                        <Cell key={v.verdict} fill={v.verdict === "FAKE" ? "var(--fake)" : "var(--real)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="No records in the current cube." />
              )}
            </ChartCard>
          </div>

          <div className="surface mt-5 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="p-4 text-left text-sm text-muted-foreground">
                Low-confidence claims by topic (measure: COUNT where band = Low)
              </caption>
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Topic</th>
                  <th className="p-3">Claims</th>
                  <th className="p-3">Low-confidence</th>
                  <th className="p-3">Fake %</th>
                </tr>
              </thead>
              <tbody>
                {topics.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={4}>
                      No rows in the current cube.
                    </td>
                  </tr>
                )}
                {topics.map((t) => (
                  <tr key={t.topic} className="border-t border-border">
                    <td className="p-3 capitalize">{t.topic}</td>
                    <td className="p-3 tabular-nums">{t.total}</td>
                    <td className="p-3 tabular-nums">{t.lowConfidence}</td>
                    <td className="p-3 tabular-nums">{t.fakePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---------- K-Means ---------- */}
        <Section
          id="kmeans"
          concept="K-Means Clustering"
          title="K-Means clustering (k = 3)"
          description="Unsupervised grouping of claims using the eight credibility aspect scores as features. Cluster names are derived from measured centroid characteristics, not assigned by index."
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="surface p-5">
              <p className="eyebrow">How K-Means works</p>
              <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {[
                  "Select the eight credibility features.",
                  "Normalise each feature to a 0–1 range.",
                  "Initialise 3 centroids.",
                  "Assign every claim to its nearest centroid.",
                  "Recalculate each centroid as the mean of its members.",
                  "Repeat until assignments stop changing (convergence).",
                  "Interpret each cluster from its average scores.",
                ].map((s, i) => (
                  <li key={s}>
                    <strong className="text-foreground">Step {i + 1}:</strong> {s}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Converged in {km.iterations} iteration{km.iterations === 1 ? "" : "s"} over {facts.length} records.
              </p>
            </div>

            <ChartCard title="Cluster visualisation" subtitle="Sensational vocabulary vs source attribution">
              {scatterData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ bottom: 20, left: 5 }}>
                    <CartesianGrid stroke="var(--border)" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Sensational score", position: "insideBottom", offset: -10, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Source attribution", angle: -90, position: "insideLeft", fontSize: 11 }}
                    />
                    <ZAxis range={[70, 70]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Legend />
                    {km.clusters.map((c) => (
                      <Scatter
                        key={c.clusterId}
                        name={`C${c.clusterId + 1} · ${c.label}`}
                        data={scatterData.filter((p) => p.cluster === c.clusterId)}
                        fill={clusterColor(c.clusterId)}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <Empty note="Clustering needs at least one record." />
              )}
            </ChartCard>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {km.clusters.length === 0 && <Empty note="No clusters — the current cube is empty." />}
            {km.clusters.map((c) => (
              <div key={c.clusterId} className="surface p-5">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: clusterColor(c.clusterId) }} />
                  <p className="font-display text-base font-bold">
                    Cluster {c.clusterId + 1} — {c.label}
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Detail k="Claims" v={String(c.size)} />
                  <Detail k="Avg confidence" v={`${c.avgConfidence}%`} />
                  <Detail k="Fake" v={`${c.fakePct}%`} />
                  <Detail k="Real" v={`${c.realPct}%`} />
                </dl>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Average aspect scores
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {ASPECT_IDS.map((id) => (
                    <li key={id} className="flex justify-between gap-2">
                      <span>{ASPECT_LABELS[id]}</span>
                      <span className="tabular-nums text-foreground">{c.avgScores[id]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- Insights ---------- */}
        <Section
          id="insights"
          concept="Data Mining"
          title="Automatically discovered insights"
          description="Generated at runtime from the current cube — nothing here is written by hand."
        >
          {insights.length === 0 ? (
            <Empty note="Insights appear once the warehouse contains records." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((i) => (
                <div key={i.title} className="surface p-5">
                  <p className="font-display text-sm font-bold">{i.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{i.body}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ---------- Warehouse records ---------- */}
        <Section
          id="records"
          concept="Data Warehouse"
          title="Warehouse records"
          description="Transformed Fact_Verification rows joined with their dimension values."
          action={
            <Button
              variant="outline"
              size="sm"
              disabled={!tableRows.length}
              onClick={() => downloadCsv("fndvs_warehouse.csv", toCsv(wh, tableRows))}
            >
              Export CSV
            </Button>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="wh-search">Search claim text</Label>
            <Input
              id="wh-search"
              value={q}
              placeholder="Search warehouse records…"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Topic, verdict and confidence filters are shared with the OLAP cube controls above.
            </p>
          </div>

          <div className="surface mt-4 overflow-x-auto p-0">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  {["ID", "Date", "Topic", "Verdict", "Conf.", "Band", ...ASPECT_IDS.map((a) => ASPECT_SHORT[a])].map(
                    (h) => (
                      <th key={h} className="whitespace-nowrap p-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={14}>
                      No warehouse rows match the current filters.
                    </td>
                  </tr>
                )}
                {pageRows.map((f) => (
                  <tr key={f.verification_id} className="border-t border-border">
                    <td className="whitespace-nowrap p-3 font-mono text-xs">{f.verification_id}</td>
                    <td className="whitespace-nowrap p-3">{f.date_id}</td>
                    <td className="whitespace-nowrap p-3 capitalize">{topicName(wh, f.topic_id)}</td>
                    <td className="p-3">
                      <span className={f.verdict_id === 0 ? "text-fake" : "text-real"}>
                        {verdictName(f.verdict_id)}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">{round1(f.confidence_score)}</td>
                    <td className="p-3">{f.confidence_band}</td>
                    {ASPECT_IDS.map((a) => (
                      <td key={a} className="p-3 tabular-nums">
                        {f.scores[a]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tableRows.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {pages} · {tableRows.length} row{tableRows.length === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Section>

      </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="font-display text-lg font-bold tabular-nums">{v}</dd>
    </div>
  );
}

function SchemaCard({ title, rows, count }: { title: string; rows: string[]; count: number }) {
  return (
    <div className="surface p-4">
      <p className="eyebrow">Dimension</p>
      <p className="mt-1 font-display text-base font-bold">{title}</p>
      <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-semibold text-foreground">{count} members</p>
    </div>
  );
}

function OlapCard({
  title,
  body,
  cta,
  onClick,
  active,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <div className={`surface p-4 ${active ? "border-primary/50" : ""}`}>
      <p className="font-display text-sm font-bold uppercase tracking-wide">{title}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
      <Button size="sm" variant={active ? "default" : "outline"} className="mt-3" onClick={onClick}>
        {cta}
      </Button>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <h3 className="font-display text-base font-bold">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 h-72">{children}</div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
