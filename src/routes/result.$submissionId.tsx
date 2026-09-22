import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Sparkles, CheckCircle2, HelpCircle } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  LabelBadge,
  ConfidenceMeter,
  LowConfidenceNotice,
  Disclaimer,
  TermChips,
  AspectRow,
  SourceList,
} from "@/components/PredictionUI";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRecord, updateRecord, type VerificationRecord } from "@/lib/store";
import {
  runGeminiVerify,
  GEMINI_VERDICT_TEXT,
  type GeminiVerdict,
  type GeminiVerdictLabel,
} from "@/lib/gemini";
import type { PredictionLabel } from "@/lib/predict";

export const Route = createFileRoute("/result/$submissionId")({
  component: ResultPage,
  head: () => ({
    meta: [
      { title: "Verification report — FNDVS" },
      {
        name: "description",
        content:
          "Full credibility report: rule-based verdict, Gemini second opinion, eight analysed aspects and the official Indian sources to cross-check against.",
      },
      { property: "og:title", content: "Verification report — FNDVS" },
      {
        property: "og:description",
        content: "Explainable credibility verdict plus an independent AI second opinion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ResultPage() {
  const { submissionId } = Route.useParams();
  const [record, setRecord] = useState<VerificationRecord | null | undefined>(undefined);
  const [gemini, setGemini] = useState<GeminiVerdict | null>(null);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  useEffect(() => {
    const found = getRecord(submissionId) ?? null;
    setRecord(found);
    setGemini(found?.geminiVerdict ?? null);
  }, [submissionId]);

  const result = record?.result;

  const onRunGemini = async () => {
    if (!record) return;
    setGeminiError(null);
    setGeminiBusy(true);
    try {
      const verdict = await runGeminiVerify(record.text);
      setGemini(verdict);
      updateRecord(record.id, { geminiVerdict: verdict });
    } catch (e) {
      setGeminiError(e instanceof Error ? e.message : "Gemini analysis failed — please try again.");
    } finally {
      setGeminiBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Verification report"
          title="Credibility assessment"
          description="Two independent reads of the same claim: the rule-based language analysis, and a Gemini AI second opinion. Every signal is shown in full."
        />

        {record === undefined && <p className="mt-8 text-sm text-muted-foreground">Loading report…</p>}

        {record === null && (
          <div className="surface mt-8 p-6">
            <h2 className="text-lg font-semibold">Report unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This report isn't stored in this browser. Reports are kept locally on the device that
              ran the check.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/submit">Run a new check</Link>
            </Button>
          </div>
        )}

        {record && result && (
          <div className="mt-8 space-y-6">
            <FinalVerdict
              ruleLabel={result.label}
              ruleConfidence={result.confidenceScore}
              gemini={gemini}
            />

            <Tabs defaultValue="rules">
              <TabsList className="w-full">
                <TabsTrigger value="rules" className="flex-1">
                  Rule-based analysis
                </TabsTrigger>
                <TabsTrigger value="gemini" className="flex-1">
                  Gemini analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rules" className="mt-4 space-y-6">
                <div className="surface p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <LabelBadge label={result.label} size="lg" />
                    <span className="text-sm text-muted-foreground">
                      {new Date(record.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-6">
                    <ConfidenceMeter score={result.confidenceScore} />
                  </div>
                  <p className="mt-5 text-sm leading-relaxed">{result.summary}</p>
                  <div className="mt-5">
                    <LowConfidenceNotice score={result.confidenceScore} />
                  </div>
                </div>

                <div className="surface p-6">
                  <h2 className="eyebrow">What we checked — {result.aspects.length} aspects</h2>
                  <ul className="mt-2">
                    {result.aspects.map((a) => (
                      <AspectRow key={a.id} aspect={a} />
                    ))}
                  </ul>
                </div>

                <div className="surface p-6">
                  <h2 className="eyebrow">Where to confirm this — official Indian sources</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Detected subject area:{" "}
                    <span className="font-medium text-foreground">{result.topics.join(", ")}</span>.
                    These are the authoritative desks that publish on it.
                  </p>
                  <div className="mt-4">
                    <SourceList matches={result.sources} />
                  </div>
                </div>

                <div className="surface p-6">
                  <h2 className="eyebrow">Key terms influencing this verdict</h2>
                  <div className="mt-3">
                    <TermChips terms={result.explanation} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="gemini" className="mt-4">
                <GeminiPanel
                  verdict={gemini}
                  busy={geminiBusy}
                  error={geminiError}
                  onRun={onRunGemini}
                />
              </TabsContent>
            </Tabs>

            <div className="surface p-6">
              <h2 className="eyebrow">
                Submitted text · {result.readingLevelWords} words
                {record.fromImage ? " · read from an image" : ""}
              </h2>
              {record.imageDataUrl && (
                <img
                  src={record.imageDataUrl}
                  alt="Screenshot submitted with this claim"
                  className="mt-3 max-h-72 w-auto rounded-md border border-border object-contain"
                />
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

/** Maps both engines onto a shared true/false/unknown axis for the inference line. */
function leaning(label: PredictionLabel | GeminiVerdictLabel): "true" | "false" | "unknown" {
  if (label === "REAL" || label === "likely-true") return "true";
  if (label === "FAKE" || label === "likely-false") return "false";
  return "unknown";
}

function FinalVerdict({
  ruleLabel,
  ruleConfidence,
  gemini,
}: {
  ruleLabel: PredictionLabel;
  ruleConfidence: number;
  gemini: GeminiVerdict | null;
}) {
  const ruleSide = leaning(ruleLabel);
  const aiSide = gemini ? leaning(gemini.verdict) : null;

  const agreement = aiSide === null ? null : aiSide === ruleSide && ruleSide !== "unknown";
  const combined =
    agreement === null
      ? "Run the Gemini analysis for a second opinion"
      : agreement
        ? ruleSide === "false"
          ? "Both engines agree: treat this as likely false"
          : "Both engines agree: this reads as credible"
        : "The two engines disagree — treat this as unresolved";

  const tone =
    agreement === null
      ? "border-border"
      : agreement
        ? ruleSide === "false"
          ? "border-fake/50 bg-fake-soft"
          : "border-real/50 bg-real-soft"
        : "border-border bg-muted";

  return (
    <div className={`surface border p-6 ${tone}`}>
      <h2 className="eyebrow">Final inference</h2>
      <p className="mt-2 text-xl font-semibold leading-snug">{combined}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            As per the rule-based analysis
          </p>
          <div className="mt-2 flex items-center gap-3">
            <LabelBadge label={ruleLabel} />
            <span className="text-sm text-muted-foreground">{ruleConfidence}% confidence</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Judges the wording, tone, attribution and framing of the text.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            As per Gemini
          </p>
          {gemini ? (
            <>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-base font-semibold">
                  {GEMINI_VERDICT_TEXT[gemini.verdict]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {gemini.confidence}% confidence
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Reasons about the substance and plausibility of the claim itself.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Not run yet — open the Gemini analysis tab below.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        The two can differ by design: one reads how the claim is written, the other reasons about what
        it says. Gemini has no live internet access here, so when they disagree, confirm the claim with
        the official sources listed in the rule-based tab.
      </p>
    </div>
  );
}

function GeminiPanel({
  verdict,
  busy,
  error,
  onRun,
}: {
  verdict: GeminiVerdict | null;
  busy: boolean;
  error: string | null;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="eyebrow">Gemini second opinion</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              An independent AI read of the same claim — its own verdict, the red flags or supporting
              signals it found, and what to check next. Reasoning-based, not a live fact-check.
            </p>
          </div>
          <Button onClick={onRun} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Analysing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" aria-hidden="true" />
                {verdict ? "Run again" : "Run Gemini analysis"}
              </>
            )}
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-fake-soft p-4 text-sm font-medium text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {verdict && (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                  verdict.verdict === "likely-false"
                    ? "bg-fake text-fake-foreground"
                    : verdict.verdict === "likely-true"
                      ? "bg-real text-real-foreground"
                      : "bg-muted text-foreground"
                }`}
              >
                {verdict.verdict === "unverifiable" ? (
                  <HelpCircle className="size-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                {GEMINI_VERDICT_TEXT[verdict.verdict]}
              </span>
              <span className="text-sm text-muted-foreground">
                {verdict.confidence}% confidence
              </span>
            </div>

            <p className="text-sm leading-relaxed">{verdict.reasoning}</p>

            {verdict.signals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">What Gemini noticed</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {verdict.signals.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {verdict.nextSteps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">What you should check next</h3>
                <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {verdict.nextSteps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-medium text-foreground">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {!verdict && !busy && !error && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing run yet. The rule-based report on the other tab is already complete.
          </p>
        )}
      </div>
    </div>
  );
}
