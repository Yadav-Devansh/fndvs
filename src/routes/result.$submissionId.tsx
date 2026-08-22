import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { getRecord, type VerificationRecord } from "@/lib/store";

export const Route = createFileRoute("/result/$submissionId")({
  component: ResultPage,
  head: () => ({
    meta: [
      { title: "Verification report — FNDVS" },
      {
        name: "description",
        content:
          "Full credibility report: verdict, confidence score, eight analysed aspects and the official Indian sources to cross-check against.",
      },
      { property: "og:title", content: "Verification report — FNDVS" },
      {
        property: "og:description",
        content: "Explainable credibility verdict with official source corroboration.",
      },
    ],
  }),
});

function ResultPage() {
  const { submissionId } = Route.useParams();
  const [record, setRecord] = useState<VerificationRecord | null | undefined>(undefined);

  useEffect(() => {
    setRecord(getRecord(submissionId) ?? null);
  }, [submissionId]);

  const result = record?.result;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Verification report"
          title="Credibility assessment"
          description="Every signal below is computed from the submitted text and shown in full — nothing is hidden behind a score."
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
                <span className="font-medium text-foreground">{result.topics.join(", ")}</span>. These
                are the authoritative desks that publish on it.
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

            <div className="surface p-6">
              <h2 className="eyebrow">Submitted text · {result.readingLevelWords} words</h2>
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
