/** Runs every check for a claim and assembles the report. */
import { analyze } from "../detect";
import { decide } from "./decide";
import { lookupFactChecks } from "./factcheck";
import { runGrounded } from "./gateway.server";
import { lookupNews } from "./news";
import type { EvidenceItem, VerificationReport } from "./types";

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

export async function buildReport(text: string): Promise<VerificationReport> {
  const signals = analyze(text);
  const [factCheck, news] = await Promise.all([lookupFactChecks(text), lookupNews(text)]);
  const officialSources = signals.sources.slice(0, 5).map(({ source }) => ({
    id: source.id,
    name: source.name,
    url: source.url,
  }));
  const gemini = await runGrounded(text, evidenceItems({ factCheck, news, officialSources }));
  const decision = decide(
    {
      factChecks: factCheck.records,
      corroboratingDomains: news.corroboratingDomains,
      gemini: gemini.result ?? null,
    },
    signals.languageRisk,
  );
  return {
    checkedAt: new Date().toISOString(),
    decision,
    languageRisk: signals.languageRisk,
    factCheck,
    news,
    gemini,
    officialSources,
  };
}
