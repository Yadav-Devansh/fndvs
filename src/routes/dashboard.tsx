import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/PredictionUI";
import { useRecords } from "./history";

export const Route = createFileRoute("/dashboard")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights — FNDVS" },
      {
        name: "description",
        content:
          "Aggregate view of your verification activity: misleading-vs-unverified split, average language risk and the credibility aspects that fail most often.",
      },
      { property: "og:title", content: "Insights — FNDVS" },
      { property: "og:description", content: "Trends across every claim you have checked." },
    ],
  }),
});

function InsightsPage() {
  const allRecords = useRecords();
  const [includeSamples, setIncludeSamples] = useState(false);
  const records = useMemo(
    () => (includeSamples ? allRecords : allRecords.filter((r) => !r.sample)),
    [allRecords, includeSamples],
  );

  const stats = useMemo(() => {
    const total = records.length;
    const fake = records.filter((r) => r.result.label === "FAKE").length;
    const avg = total ? records.reduce((s, r) => s + r.result.riskScore, 0) / total : 0;
    const low = records.filter((r) => r.result.languageRisk === "high").length;

    const aspectTotals = new Map<string, { sum: number; n: number }>();
    for (const r of records) {
      for (const a of r.result.aspects) {
        if (a.score === null) continue;
        const cur = aspectTotals.get(a.label) ?? { sum: 0, n: 0 };
        aspectTotals.set(a.label, { sum: cur.sum + a.score, n: cur.n + 1 });
      }
    }
    const aspects = [...aspectTotals.entries()]
      .map(([label, v]) => ({ label, score: Math.round(v.sum / v.n) }))
      .sort((a, b) => a.score - b.score);

    const topicCounts = new Map<string, number>();
    for (const r of records) {
      for (const t of r.result.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
    }

    return {
      total,
      fake,
      real: total - fake,
      avg,
      low,
      aspects,
      topics: [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [records]);

  const pieData = [
    { name: "Likely misleading", value: stats.fake, fill: "var(--fake)" },
    { name: "Unverified", value: stats.real, fill: "var(--caution)" },
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <PageHeader
          eyebrow="Insights"
          title="Verification trends"
          description="Aggregated across every claim checked in this browser."
          action={
            <Button asChild>
              <Link to="/submit">New check</Link>
            </Button>
          }
        />

        <div className="mt-6 flex items-center gap-3">
          <Switch id="include-samples" checked={includeSamples} onCheckedChange={setIncludeSamples} />
          <Label htmlFor="include-samples" className="text-sm">
            Include sample claims
          </Label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total checks" value={stats.total.toString()} />
          <Stat label="Flagged likely misleading" value={stats.fake.toString()} tone="fake" />
          <Stat label="Average risk score" value={Math.round(stats.avg).toString()} />
          <Stat label="High language risk" value={stats.low.toString()} tone="caution" />
        </div>

        {stats.total > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="surface p-6">
              <h2 className="eyebrow">Verdict distribution</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-6 text-sm">
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-fake" /> Likely misleading · {stats.fake}
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-caution" /> Unverified · {stats.real}
                </span>
              </div>
            </div>

            <div className="surface p-6">
              <h2 className="eyebrow">Average score by aspect</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.aspects} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <Tooltip />
                    <Bar dataKey="score" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface p-6 lg:col-span-2">
              <h2 className="eyebrow">Most-checked subject areas</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {stats.topics.map(([topic, count]) => (
                  <li
                    key={topic}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-sm capitalize text-secondary-foreground"
                  >
                    {topic} · {count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "fake" | "caution";
}) {
  const color = tone === "fake" ? "text-fake" : tone === "caution" ? "text-caution" : "text-foreground";
  return (
    <div className="surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
