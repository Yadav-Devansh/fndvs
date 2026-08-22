import { AlertTriangle, CheckCircle2, XCircle, ExternalLink, MinusCircle } from "lucide-react";
import { confidenceBand, DISCLAIMER, type Aspect } from "@/lib/predict";
import type { SourceMatch } from "@/lib/sources";

export function LabelBadge({ label, size = "sm" }: { label: string; size?: "sm" | "lg" }) {
  const fake = label === "FAKE";
  const Icon = fake ? XCircle : CheckCircle2;
  const base = fake
    ? "bg-fake-soft text-fake border-fake/30"
    : "bg-real-soft text-real border-real/30";
  const dims =
    size === "lg"
      ? "gap-2 px-4 py-2 text-base font-bold tracking-wide"
      : "gap-1.5 px-2.5 py-1 text-xs font-semibold";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-display ${base} ${dims}`}
    >
      <Icon className={size === "lg" ? "size-5" : "size-3.5"} aria-hidden="true" />
      {fake ? "LIKELY FAKE" : "LIKELY GENUINE"}
    </span>
  );
}

export function ConfidenceMeter({ score }: { score: number }) {
  const band = confidenceBand(score);
  const barColor =
    band === "low" ? "bg-caution" : band === "moderate" ? "bg-primary" : "bg-real";
  const wording =
    band === "low" ? "Low confidence" : band === "moderate" ? "Moderate confidence" : "Strong confidence";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{wording}</span>
        <span className="font-display text-2xl font-bold tabular-nums">{score.toFixed(1)}%</span>
      </div>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(score)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Confidence score"
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function LowConfidenceNotice({ score }: { score: number }) {
  if (confidenceBand(score) !== "low") return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-caution/40 bg-caution-soft p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-caution" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        Low-confidence result — interpret with caution. The analysis engine found weak signal in
        this text. Treat the official sources below as the deciding evidence.
      </p>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
      {DISCLAIMER}
    </p>
  );
}

export function TermChips({ terms }: { terms: string[] }) {
  if (!terms.length) return <p className="text-sm text-muted-foreground">No notable terms.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {terms.map((t) => (
        <li
          key={t}
          className="rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground"
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

const verdictMeta = {
  pass: { Icon: CheckCircle2, tone: "text-real", bar: "bg-real", word: "Clear" },
  warn: { Icon: MinusCircle, tone: "text-caution", bar: "bg-caution", word: "Caution" },
  fail: { Icon: XCircle, tone: "text-fake", bar: "bg-fake", word: "Concern" },
} as const;

export function AspectRow({ aspect }: { aspect: Aspect }) {
  const meta = verdictMeta[aspect.verdict];
  return (
    <li className="border-b border-border py-4 last:border-0">
      <div className="flex items-start gap-3">
        <meta.Icon className={`mt-0.5 size-5 shrink-0 ${meta.tone}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{aspect.label}</h3>
            <span className={`text-xs font-semibold uppercase tracking-wider ${meta.tone}`}>
              {meta.word} · {Math.round(aspect.score)}/100
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${aspect.score}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{aspect.detail}</p>
          {aspect.evidence.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {aspect.evidence.map((e) => (
                <li
                  key={e}
                  className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-secondary-foreground"
                >
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export function SourceList({ matches }: { matches: SourceMatch[] }) {
  return (
    <ul className="space-y-3">
      {matches.map(({ source, topic, relevance }) => (
        <li key={source.id} className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{source.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{source.mandate}</p>
            </div>
            <span className="rounded-full border border-real/30 bg-real-soft px-2.5 py-1 text-xs font-semibold text-real">
              {relevance}% relevant
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
            >
              Open {source.shortName} <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              {topic}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
