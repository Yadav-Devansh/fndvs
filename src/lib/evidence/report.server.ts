/** Runs the checks for a claim in the order the A* planner chose, and assembles the report. */
import { analyze } from "../detect";
import { astar, orderPlan, problemFor } from "../planner";
import { decide } from "./decide";
import { lookupFactChecks } from "./factcheck";
import { runGrounded } from "./gateway.server";
import { lookupNews } from "./news";
import type { EvidenceItem, FactCheckLookup, GeminiLookup, NewsLookup, PlanCheck, VerificationReport } from "./types";

export function evidenceItems(report: Pick<VerificationReport, "factCheck" | "news" | "officialSources">): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const f of report.factCheck.records) {
    items.push({
      id: f.id,
      kind: "fact-check",
      text: `${f.publisher} rated the claim "${f.claimText || f.title}" as "${f.rating}" (${f.reviewedAt?.slice(0, 10) ?? "date unknown"}).`,
    });
  }
  for (const a of report.news.articles) {
    items.push({
      id: a.id,
      kind: "article",
      text: `${a.domain}${a.reputable ? " (reputable outlet)" : ""}, ${a.seenAt?.slice(0, 10) ?? "date unknown"}: "${a.title}"`,
    });
  }
  report.officialSources.forEach((s, i) =>
    items.push({ id: `S${i + 1}`, kind: "official-source", text: `${s.name} — ${s.url}` }),
  );
  return items;
}

const SKIPPED = "Skipped by plan — enough evidence without it.";

export async function buildReport(text: string): Promise<VerificationReport> {
  // 1. Cheap local checks (always computed: they are free and feed the gains).
  const signals = analyze(text);
  const officialSources = signals.sources.slice(0, 5).map(({ source }) => ({ id: source.id, name: source.name, url: source.url }));

  // 2. Plan with A*.
  const problem = problemFor(signals);
  const result = astar(problem);
  const order = orderPlan(problem, result.plan);

  let factCheck: FactCheckLookup = { status: "skipped", records: [], message: SKIPPED };
  let news: NewsLookup = {
    status: "skipped", provider: "GDELT DOC 2.0", windowDays: 0, keyTerms: [], articles: [],
    corroboratingDomains: [], corroborated: false, message: SKIPPED,
  };
  let gemini: GeminiLookup = { status: "skipped", message: SKIPPED };

  // 3. Run planned checks in order; stop as soon as E(S) >= T.
  let e = 0;
  let cost = 0;
  const planChecks: PlanCheck[] = [];
  for (const i of order) {
    const c = problem.checks[i]!;
    if (e >= problem.threshold - 1e-9) {
      planChecks.push({ id: c.id, label: c.label, cost: c.cost, gain: c.gain, estimated: c.estimated, status: "stopped-early" });
      continue;
    }
    if (c.id === "factcheck") factCheck = await lookupFactChecks(text);
    else if (c.id === "news") news = await lookupNews(text);
    else if (c.id === "gemini") gemini = await runGrounded(text, evidenceItems({ factCheck, news, officialSources }));
    e += c.gain;
    cost += c.cost;
    planChecks.push({ id: c.id, label: c.label, cost: c.cost, gain: c.gain, estimated: c.estimated, status: "run" });
  }

  const decision = decide(
    { factChecks: factCheck.records, corroboratingDomains: news.corroboratingDomains, gemini: gemini.result ?? null },
    signals.languageRisk,
  );
  const executed = planChecks.filter((c) => c.status === "run").map((c) => c.label);
  const inPlan = new Set(planChecks.map((c) => c.id));
  const skipped = [
    ...problem.checks.filter((c) => !inPlan.has(c.id)).map((c) => c.label),
    ...planChecks.filter((c) => c.status === "stopped-early").map((c) => c.label),
  ];
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    checkedAt: new Date().toISOString(),
    decision,
    languageRisk: signals.languageRisk,
    factCheck,
    news,
    gemini,
    officialSources,
    plan: {
      plan: planChecks,
      executed,
      skipped,
      totalCost: round(cost),
      costIfAll: round(problem.checks.reduce((s, c) => s + c.cost, 0)),
      checksTotal: problem.checks.length,
      threshold: round(problem.threshold),
      evidence: round(e),
    },
  };
}
