import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Ban, CheckCircle2, CircleSlash, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  LabelBadge,
  RiskMeter,
  EngineNotices,
  Disclaimer,
  AspectRow,
  SourceList,
} from "@/components/PredictionUI";
import { Button } from "@/components/ui/button";
import { getRecord, updateRecord, type VerificationRecord } from "@/lib/store";
import { runVerification } from "@/lib/gemini";
import type { LanguageRisk } from "@/lib/predict";
import type { LookupStatus, VerificationReport } from "@/lib/evidence/types";

export const Route = createFileRoute("/result/$submissionId")({
  component: ResultPage,
  head: () => ({
    meta: [
      { title: "Verification report — FNDVS" },
      {
        name: "description",
        content:
          "Evidence-based verdict: published fact-checks, reputable news coverage, an evidence-only AI read and the official Indian desks to confirm with.",
      },
      { property: "og:title", content: "Verification report — FNDVS" },
      {
        property: "og:description",
        content: "A verdict built from published fact-checks and news coverage, not opinion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const CONF_TEXT = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;
const BUCKET_TEXT = {
  false: "Rated false",
  misleading: "Rated misleading",
  true: "Rated true",
  mixed: "Rated partly true",
  unknown: "Rating not recognised",
} as const;
const GEMINI_TEXT = {
  supported: "Evidence supports the claim",
  contradicted: "Evidence contradicts the claim",
  unverifiable: "Evidence does not settle it",
} as const;

function ResultPage() {
  const { submissionId } = Route.useParams();
  const [record, setRecord] = useState<VerificationRecord | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (r: VerificationRecord) => {
    setError(null);
    setBusy(true);
    try {
      const evidence = await runVerification(r.text);
      const updated = updateRecord(r.id, { evidence, verdict: evidence.decision.verdict });
      setRecord(updated ?? { ...r, evidence, verdict: evidence.decision.verdict });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed — please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const found = getRecord(submissionId) ?? null;
    setRecord(found);
    if (found && !found.evidence) void check(found);
  }, [submissionId, check]);

  const result = record?.result;
  const report = record?.evidence;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Verification report"
          title="Is this claim verified?"
          description="The verdict comes from published fact-checks and reputable news coverage. Wording signals and the AI read can't make a claim credible on their own."
        />

        {record === undefined && <p className="mt-8 text-sm text-muted-foreground">Loading report…</p>}

        {record === null && (
          <div className="surface mt-8 p-6">
            <h2 className="text-lg font-semibold">Report unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This report isn't stored in this browser. Reports live only on the device that created them.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/submit">Verify a claim</Link>
            </Button>
          </div>
        )}

        {record && result && (
          <div className="mt-8 space-y-6">
            {/* 1. Final verdict */}
            <div className="surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="eyebrow">Final verdict</h2>
                <Button variant="outline" size="sm" onClick={() => void check(record)} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {busy ? "Checking sources…" : "Check again"}
                </Button>
              </div>
              {busy && <CheckProgress />}
              {error && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-fake-soft p-4 text-sm font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              {report && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <LabelBadge label={report.decision.verdict} size="lg" />
                    <span className="text-sm text-muted-foreground">{CONF_TEXT[report.decision.confidence]}</span>
                  </div>
                  <p className="text-lg font-semibold leading-snug">{report.decision.headline}</p>
                  {report.decision.reasons.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {report.decision.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What to check next</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {report.decision.nextSteps.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Checked {new Date(report.checkedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {report?.plan && (
              <div className="surface p-4 text-sm">
                <p className="font-semibold">
                  Plan used: {report.plan.executed.length} of {report.plan.checksTotal} checks, cost {report.plan.totalCost} vs{" "}
                  {report.plan.costIfAll} for running everything.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Chosen by the A* planner to reach enough evidence at the lowest cost.
                </p>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Checks in the plan">
                  {report.plan.plan.map((c) => (
                    <li key={c.id} className="flex items-center gap-1.5">
                      <span>{c.label}</span>
                      <StatusChip status={c.status === "run" ? "ok" : "skipped"} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. Evidence */}
            {report && <EvidenceList report={report} />}

            {/* 3. Language risk */}
            <div className="flex flex-wrap items-center gap-3">
              <LanguageChip risk={result.languageRisk} />
              <span className="text-xs text-muted-foreground">Reads wording only, not facts.</span>
            </div>

            {/* 4. Official desks */}
            <div className="surface p-6">
              <h2 className="eyebrow">Official desks to check</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Subject area: <span className="font-medium text-foreground">{result.topics.join(", ")}</span>.
              </p>
              <div className="mt-4">
                <SourceList matches={result.sources} />
              </div>
            </div>

            <details className="surface p-6">
              <summary className="cursor-pointer text-sm font-semibold">
                Wording signals in detail (linguistic risk, not facts)
              </summary>
              <div className="mt-4 space-y-4">
                <RiskMeter riskScore={result.riskScore} languageRisk={result.languageRisk} evidenceStrength={result.evidenceStrength} />
                <EngineNotices notices={result.notices} />
                <ul>
                  {result.aspects.map((a) => <AspectRow key={a.id} aspect={a} />)}
                </ul>
              </div>
            </details>

            <div className="surface p-6">
              <h2 className="eyebrow">
                Submitted text{record.fromImage ? " · read from an image" : ""}
              </h2>
              {record.imageDataUrl && (
                <img src={record.imageDataUrl} alt="Screenshot submitted with this claim" className="mt-3 max-h-72 w-auto rounded-md border border-border object-contain" />
              )}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{record.text}</p>
            </div>

            <Disclaimer />

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/submit">Check another claim</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/history">View all records</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LanguageChip({ risk }: { risk: LanguageRisk }) {
  const tone =
    risk === "high" ? "border-fake/40 bg-fake-soft" : risk === "medium" ? "border-caution/40 bg-caution-soft" : "border-border bg-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Language risk: {risk}
    </span>
  );
}

const CHIP = {
  ok: { text: "Done", Icon: CheckCircle2, cls: "border-real/50 text-foreground" },
  skipped: { text: "Skipped by plan", Icon: CircleSlash, cls: "border-border text-muted-foreground" },
  "not-configured": { text: "Not configured", Icon: Ban, cls: "border-border text-muted-foreground" },
  error: { text: "Failed", Icon: XCircle, cls: "border-destructive/60 text-destructive" },
} as const;

/** Status chip: always icon + word, never colour alone. */
function StatusChip({ status }: { status: LookupStatus }) {
  const { text, Icon, cls } = CHIP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {text}
    </span>
  );
}

const STAGES = ["Checking wording signals", "Matching official sources", "Searching published fact-checks", "Searching news coverage", "AI read of the evidence"];

/** The server runs checks in one request, so this shows the usual order with an estimated current step. */
function CheckProgress() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STAGES.length - 1)), 1200);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="mt-3 text-sm">
      <p className="font-medium">Now: {STAGES[i]}…</p>
      <ol className="mt-2 space-y-1 text-muted-foreground">
        {STAGES.map((s, n) => (
          <li key={s} className="flex items-center gap-2">
            {n < i ? <CheckCircle2 className="size-4" aria-hidden="true" /> : n === i ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <span className="inline-block size-4" aria-hidden="true" />}
            <span className={n === i ? "text-foreground" : ""}>{s}{n < i ? " (done)" : n === i ? " (running)" : ""}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-muted-foreground">Order shown is typical; the planner may skip some checks.</p>
    </div>
  );
}

function StatusNote({ status, message }: { status: LookupStatus; message?: string | undefined }) {
  if (status === "ok") return null;
  return <p className="mt-2 text-sm text-muted-foreground">{message ?? "Not available."}</p>;
}

function EvidenceList({ report }: { report: VerificationReport }) {
  const { factCheck, news, gemini } = report;
  const relevantNews = news.articles.filter((a) => a.matchRatio >= 0.6);
  const nothing = factCheck.records.length === 0 && news.corroboratingDomains.length === 0;

  return (
    <div className="surface space-y-6 p-6">
      <h2 className="eyebrow">Evidence</h2>
      {nothing && (
        <p className="rounded-lg border border-border bg-muted p-4 text-sm font-medium">
          Unverified — nothing in our sources settles this. Check the official desks below before sharing.
        </p>
      )}

      <section>
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Published fact-checks <StatusChip status={factCheck.status} /></h3>
        <StatusNote status={factCheck.status} message={factCheck.message} />
        {factCheck.status === "ok" && factCheck.records.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">No published fact-check matched this claim.</p>
        )}
        <ul className="mt-2 space-y-3">
          {factCheck.records.map((f) => (
            <li key={f.id} className="rounded-lg border border-border bg-background p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{f.id}</span>
                <span className="font-semibold">{f.publisher}</span>
                <span>· {BUCKET_TEXT[f.ratingBucket]}: “{f.rating}”</span>
              </div>
              <p className="mt-1 text-muted-foreground">{f.title || f.claimText}</p>
              <a href={f.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary underline">
                Read the review <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">News coverage (last {news.windowDays} days) <StatusChip status={news.status} /></h3>
        <StatusNote status={news.status} message={news.message} />
        {news.status === "ok" && (
          <p className="mt-2 text-sm text-muted-foreground">
            {news.corroborated
              ? `Corroborated by ${news.corroboratingDomains.length} reputable outlets.`
              : `${news.corroboratingDomains.length} reputable outlet${news.corroboratingDomains.length === 1 ? "" : "s"} matched — at least 2 are needed.`}{" "}
            Searched for: {news.keyTerms.join(", ")}.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {relevantNews.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{a.id}</span>
              <a href={a.url} target="_blank" rel="noreferrer" className="font-medium underline focus-visible:outline-2 focus-visible:outline-ring">{a.title}</a>{" "}
              <span className="text-muted-foreground">
                — {a.domain}{a.reputable ? " (reputable)" : " (not on allow-list)"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">AI read of the evidence (Gemini, evidence-only) <StatusChip status={gemini.status} /></h3>
        <StatusNote status={gemini.status} message={gemini.message} />
        {gemini.result && (
          <div className="mt-2 text-sm">
            <p className="font-semibold">{GEMINI_TEXT[gemini.result.verdict]} · {gemini.result.confidence}/100</p>
            <p className="mt-1">{gemini.result.reasoning}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cited: {gemini.result.citedEvidenceIds.join(", ") || "nothing"}. It can only adjust confidence, never make a claim credible on its own.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
