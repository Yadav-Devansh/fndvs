/**
 * DWM Concept: data mining → final inference. Every sentence is generated
 * from the aggregates; nothing is hard-coded.
 */

import { aspects, categories, fmtIN, heatmap, monthlyTrend, r2, topKeywords, totals, yearly } from "./analytics";
import { apriori, buildTransactions, ruleSentence, type Rule } from "./apriori";
import { clusterSample } from "./clusters";
import type { DwmAggregates } from "./types";

export const RISK_FOOTNOTE =
  "Headlines alone lack context. This measures how many headlines show misleading-style writing patterns, not how many are proven false. It is a trend indicator, not a fact-check.";

export function analyse(agg: DwmAggregates, k = 3, minSupport = 0.02, minConfidence = 0.6) {
  const tot = totals(agg);
  const trend = monthlyTrend(agg.cube, 3);
  const years = yearly(agg.cube);
  const cats = categories(agg.cube);
  const asp = aspects(agg.cube);
  const clusters = clusterSample(agg.sample, k);
  const kws = topKeywords(agg, 40);
  const tx = buildTransactions(agg.sample, new Set(kws.all.map((w) => w.word)));
  const rules = apriori(tx, minSupport, minConfidence);
  return { tot, trend, years, cats, asp, clusters, kws, rules, heat: heatmap(agg.cube) };
}

export type Analysis = ReturnType<typeof analyse>;

export interface Finding {
  icon: "trend" | "category" | "peak" | "aspect" | "cluster" | "rule" | "confidence";
  title: string;
  value: string;
  body: string;
}

export function inference(agg: DwmAggregates, a: Analysis) {
  const m = agg.meta;
  const demo = m.isSynthetic ? "Demo only: " : "";
  if (m.rowsScored < 1000) {
    return { enough: false as const, headline: `${demo}Not enough data for a reliable inference (${fmtIN(m.rowsScored)} rows scored; at least 1,000 needed).` };
  }
  const first = a.years[0];
  const last = a.years[a.years.length - 1];
  const change = first && last ? r2(last.rate - first.rate) : 0;
  const verb = Math.abs(change) < 0.05 ? "stayed steady" : change > 0 ? "rose" : "fell";
  const headline =
    `${demo}Across ${fmtIN(m.rowsScored)} Indian headlines from ${m.windowStart} to ${m.windowEnd}, the risk-signal rate was ${a.tot.rate}%, ` +
    (verb === "stayed steady"
      ? `and it stayed steady from ${first?.year} to ${last?.year} (${change >= 0 ? "+" : ""}${change} percentage points).`
      : `and it ${verb} by ${Math.abs(change)} percentage points from ${first?.year} to ${last?.year}.`);

  const findings: Finding[] = [];
  findings.push({
    icon: "trend", title: "Overall trend", value: a.trend.direction,
    body: `The monthly risk-signal rate is ${a.trend.direction} (slope ${r2(a.trend.slope)} pp per month, R² ${r2(a.trend.r2)}). ${a.trend.r2 < 0.2 ? "The fit is weak, so month-to-month noise dominates." : "The fit explains a meaningful share of the variation."}`,
  });
  const ranked = a.cats.filter((c) => !c.small);
  const hi = ranked[0], lo = ranked[ranked.length - 1];
  if (hi && lo) findings.push({
    icon: "category", title: "Highest vs lowest category", value: `${hi.category} ${hi.rate}%`,
    body: `${hi.category} headlines carry the highest risk-signal rate (${hi.rate}%, n = ${fmtIN(hi.total)}); ${lo.category} the lowest (${lo.rate}%, n = ${fmtIN(lo.total)}).`,
  });
  const peak = a.trend.peak;
  if (peak) {
    const ev = a.trend.points.find((p) => p.key === peak.key)?.event;
    findings.push({
      icon: "peak", title: "Peak month", value: `${peak.label} ${peak.rate}%`,
      body: `${peak.label} had the highest monthly rate (${peak.rate}% vs a mean of ${a.trend.mean}%).${ev ? ` This coincides with: ${ev}.` : ""} ${a.trend.points.filter((p) => p.spike).length} month(s) are above mean + 1.5 standard deviations.`,
    });
  }
  const worst = [...a.asp].sort((x, y) => y.failRate - x.failRate)[0];
  if (worst) findings.push({
    icon: "aspect", title: "Most failed credibility aspect", value: `${worst.failRate}%`,
    body: `“${worst.aspect}” fails (score below 50) on ${worst.failRate}% of headlines, changing ${worst.changePP >= 0 ? "+" : ""}${worst.changePP} pp from the first to the last year. Short headlines rarely name a source, so this is expected.`,
  });
  const riskCluster = [...a.clusters.clusters].sort((x, y) => y.fakePct - x.fakePct)[0];
  if (riskCluster) findings.push({
    icon: "cluster", title: "Highest-risk cluster", value: `${riskCluster.fakePct}%`,
    body: `The “${riskCluster.label}” cluster holds ${fmtIN(riskCluster.size)} sampled headlines; ${riskCluster.fakePct}% carry a risk signal. Top categories: ${riskCluster.topCategories.join(", ")}.`,
  });
  const topRule: Rule | undefined = a.rules.find((r) => r.consequent === "risk=1") ?? a.rules[0];
  if (topRule) findings.push({ icon: "rule", title: "Strongest association rule", value: `lift ${topRule.lift.toFixed(2)}`, body: ruleSentence(topRule) });
  findings.push({
    icon: "confidence", title: "Low-confidence share", value: `${a.tot.lowConfPct}%`,
    body: `${a.tot.lowConfPct}% of scored headlines have scorer confidence below 60, where the verdict is closest to a coin-flip.`,
  });

  const readers = [
    hi ? `Treat sensational or urgent-sounding ${hi.category} headlines with extra caution and check an official source before sharing.` : "",
    worst ? `Most headlines do not name a source (“${worst.aspect}”), so look for the full article and who is quoted.` : "",
    `Risk signals are ${a.trend.direction === "roughly flat" ? "fairly constant over time" : a.trend.direction === "increasing" ? "becoming more common" : "becoming less common"}, so the habit of verifying matters regardless of the year.`,
    peak ? `Around big news moments (for example ${peak.label}) misleading-style writing can rise; slow down during those periods.` : "",
  ].filter(Boolean);

  const limits = [
    `Sample size: ${fmtIN(m.rowsScored)} headlines scored (${m.processingMode}).`,
    `Window: ${m.windowStart} to ${m.windowEnd} (${m.windowYears} years, ending at the dataset's latest date).`,
    "Headlines only: no article body, images or context.",
    `Rule-based scorer (${m.scorerVersion}); style signals, not truth.`,
    agg.labelled
      ? `Validation on ${agg.labelled.datasetName}: rule-based accuracy ${agg.labelled.ruleBased.accuracy}% vs majority baseline ${agg.labelled.baselineAccuracy}% (F1 ${agg.labelled.ruleBased.f1}%).`
      : "No labelled validation dataset loaded yet.",
  ];
  return { enough: true as const, headline, findings, readers, limits };
}

export function markdownReport(agg: DwmAggregates, a: Analysis): string {
  const inf = inference(agg, a);
  const m = agg.meta;
  const L: string[] = [];
  L.push(`# FNDVS DWM report: ${m.datasetName}`, "");
  if (m.isSynthetic) L.push("> **SYNTHETIC DEMO DATA. Not real news.**", "");
  L.push("## Final inference", "", inf.headline, "");
  if (inf.enough) {
    L.push("### Key findings", ...inf.findings.map((f) => `- **${f.title} (${f.value}):** ${f.body}`), "");
    L.push("### What this means for readers", ...inf.readers.map((r) => `- ${r}`), "");
    L.push("### Confidence and limits", ...inf.limits.map((r) => `- ${r}`), "");
  }
  L.push(`> ${RISK_FOOTNOTE}`, "");
  L.push("## Risk-signal rate by year", "", "| Year | Headlines | Risk-signal | Rate % | Change (pp) |", "|---|---|---|---|---|");
  for (const y of a.years) L.push(`| ${y.year} | ${fmtIN(y.total)} | ${fmtIN(y.risk)} | ${y.rate} | ${y.changePP ?? "–"} |`);
  L.push("", "## Categories", "", "| Category | Headlines | Share % | Rate % |", "|---|---|---|---|");
  for (const c of a.cats) L.push(`| ${c.category} | ${fmtIN(c.total)} | ${c.share} | ${c.rate} |`);
  L.push("", "## Credibility aspects", "", "| Aspect | Avg score | Fail rate % | Change (pp) |", "|---|---|---|---|");
  for (const x of a.asp) L.push(`| ${x.aspect} | ${x.avg} | ${x.failRate} | ${x.changePP} |`);
  L.push("", "## Method", "",
    "- **ETL:** streamed file, cleaned text, dropped empty/duplicate/out-of-window rows, normalised categories.",
    "- **Star schema:** Fact_Verification with Dim_Date, Dim_Topic, Dim_Verdict, Dim_Source, Dim_Dataset.",
    "- **OLAP:** slice, dice, roll-up and drill-down on a (year, month, category) cube of sums.",
    "- **K-Means:** 8 aspect scores on a stratified sample; elbow + silhouette.",
    "- **Apriori:** association rules over category, year, keywords, failed aspects and risk.",
    "- **Naive Bayes:** multinomial text classifier trained on the labelled set only.",
    "- **Trend analysis:** least-squares slope, moving average, spikes above mean + 1.5σ.", "",
    "## Data source", "", `${m.source}. Rows read ${fmtIN(m.rowsRead)}, kept ${fmtIN(m.rowsKept)}, scored ${fmtIN(m.rowsScored)}. Dropped: ${JSON.stringify(m.dropped)}.`,
    "Limitations: TOI headlines only, ends mid-2020; IFND's Fake class is partly generated by augmentation.",
  );
  return L.join("\n");
}
