import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { LabelBadge, Disclaimer } from "@/components/PredictionUI";
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
import { listRecords, clearRecords, type VerificationRecord } from "@/lib/store";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Verification records — FNDVS" },
      {
        name: "description",
        content:
          "Browse, search and filter every claim checked on this device, with verdicts and language-risk scores.",
      },
      { property: "og:title", content: "Verification records — FNDVS" },
      { property: "og:description", content: "Your searchable local verification log." },
    ],
  }),
});

export function useRecords() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  useEffect(() => {
    const sync = () => setRecords(listRecords());
    sync();
    window.addEventListener("fndvs:records", sync);
    return () => window.removeEventListener("fndvs:records", sync);
  }, []);
  return records;
}

function HistoryPage() {
  const records = useRecords();
  const [label, setLabel] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (label === "ALL" || r.result.label === label) &&
          (!q.trim() || r.text.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [records, label, q],
  );

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <PageHeader
          eyebrow="Records"
          title="Verification log"
          description="Every check run in this browser, newest first. Open any row for the full eight-aspect report."
          action={
            <Button asChild>
              <Link to="/submit">New check</Link>
            </Button>
          }
        />

        <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="search">Search text</Label>
            <Input
              id="search"
              value={q}
              placeholder="Search submitted claims…"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label-filter">Verdict</Label>
            <Select
              value={label}
              onValueChange={(v) => {
                setLabel(v);
                setPage(0);
              }}
            >
              <SelectTrigger id="label-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All verdicts</SelectItem>
                <SelectItem value="FAKE">Likely misleading</SelectItem>
                <SelectItem value="UNVERIFIED">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => clearRecords()}>
            Reset demo data
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {total === 0 && (
            <div className="surface p-8 text-center">
              <p className="text-sm text-muted-foreground">No records match your filters.</p>
              <Button className="mt-4" asChild>
                <Link to="/submit">Verify a claim</Link>
              </Button>
            </div>
          )}

          {rows.map((row) => (
            <Link
              key={row.id}
              to="/result/$submissionId"
              params={{ submissionId: row.id }}
              className="surface block p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(row.submittedAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-3">
                  <LabelBadge label={row.result.label} />
                  <span className="font-display text-sm font-bold tabular-nums">
                    risk {Math.round(row.result.riskScore)}
                  </span>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-foreground">{row.text}</p>
            </Link>
          ))}
        </div>

        {total > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {pages} · {total} record{total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
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

        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </AppShell>
  );
}
