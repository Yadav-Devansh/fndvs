/**
 * DWM Concept: analytical dataset export (Fact_Verification + dimension values).
 */

import { ASPECT_IDS, topicName, verdictName, type FactVerification, type Warehouse } from "./etl";

const HEADERS = [
  "verification_id",
  "date_id",
  "day",
  "month",
  "year",
  "topic_id",
  "topic_name",
  "verdict_id",
  "verdict_name",
  "confidence_score",
  "confidence_band",
  ...ASPECT_IDS.map((a) => `${a}_score`),
  "source_names",
  "claim_text",
];

function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(wh: Warehouse, facts: FactVerification[]): string {
  const lines = [HEADERS.join(",")];
  for (const f of facts) {
    const d = wh.dimDate.find((x) => x.date_id === f.date_id);
    const sources = f.source_ids
      .map((id) => wh.dimSource.find((s) => s.source_id === id)?.source_name ?? "")
      .filter(Boolean)
      .join(" | ");
    lines.push(
      [
        f.verification_id,
        f.date_id,
        d?.day ?? "",
        d?.month ?? "",
        d?.year ?? "",
        f.topic_id,
        topicName(wh, f.topic_id),
        f.verdict_id,
        verdictName(f.verdict_id),
        f.confidence_score,
        f.confidence_band,
        ...ASPECT_IDS.map((a) => f.scores[a]),
        sources,
        f.text.replace(/\s+/g, " ").trim(),
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
