import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { OFFICIAL_SOURCES } from "@/lib/sources";

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
  head: () => ({
    meta: [
      { title: "Official Indian sources — FNDVS" },
      {
        name: "description",
        content:
          "Directory of authoritative Indian government and statutory sources — PIB Fact Check, NITI Aayog, MoHFW, RBI, IMD, ISRO, ECI and more — used for corroborating news claims.",
      },
      { property: "og:title", content: "Official Indian sources — FNDVS" },
      {
        property: "og:description",
        content: "Where to confirm a claim: the authoritative Indian desks by subject area.",
      },
    ],
  }),
});

function SourcesPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <PageHeader
          eyebrow="Source directory"
          title="Where verified information comes from"
          description="FNDVS never asks you to trust its verdict alone. Every report points to the official Indian body that publishes primary information on that subject. These are the desks in the registry."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {OFFICIAL_SOURCES.map((s) => (
            <article key={s.id} className="surface flex flex-col p-5">
              <h2 className="font-display text-lg font-bold">{s.shortName}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{s.name}</p>
              <p className="mt-3 flex-1 text-sm">{s.mandate}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {s.topics.map((t) => (
                  <li
                    key={t}
                    className="rounded border border-border bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wider text-secondary-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
              >
                Visit official portal <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>

        <p className="mt-8 rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
          Organisation names, mandates and links above are genuine. The matching of a specific
          submission to a desk is simulated locally for this demonstration — always read the
          primary publication on the linked portal before drawing a conclusion.
        </p>
      </div>
    </AppShell>
  );
}
