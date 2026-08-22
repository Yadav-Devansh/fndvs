import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Gauge,
  ListTree,
  Landmark,
  Search,
  FileCheck2,
  Lock,
  ExternalLink,
} from "lucide-react";
import { OFFICIAL_SOURCES } from "@/lib/sources";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "FNDVS — Check a news claim against official Indian sources" },
      {
        name: "description",
        content:
          "Paste any headline or forwarded message and get an eight-point credibility analysis, a confidence score, and the official Indian source — PIB Fact Check, NITI Aayog, RBI, IMD and more — to confirm it against.",
      },
      { property: "og:title", content: "FNDVS — Verify news against official Indian sources" },
      {
        property: "og:description",
        content:
          "Eight-point credibility analysis with confidence scoring and links to authoritative Indian government desks.",
      },
    ],
  }),
});

const aspects = [
  "Sensational vocabulary",
  "Source attribution",
  "Emotional tone",
  "Urgency & forwarding pressure",
  "Factual specificity",
  "Writing-style integrity",
  "Clickbait framing",
  "Official corroboration path",
];

const pillars = [
  {
    icon: ListTree,
    title: "Eight-aspect breakdown",
    body: "Each report scores eight independent credibility dimensions and shows the exact words that triggered every flag.",
  },
  {
    icon: Gauge,
    title: "Honest confidence scoring",
    body: "A 0–100% score on every verdict. Anything under 60% is labelled low confidence up front, never buried.",
  },
  {
    icon: Landmark,
    title: "Official Indian sources",
    body: "Every report routes you to the authoritative desk — PIB Fact Check, NITI Aayog, MoHFW, RBI, IMD, ISRO, ECI and more.",
  },
  {
    icon: Lock,
    title: "No sign-in, no tracking",
    body: "Open access for everyone. Your checks are stored only in your own browser and never linked to an account.",
  },
];

const steps = [
  { icon: Search, title: "Paste the claim", body: "A headline, a WhatsApp forward, or a full article — 20 to 5,000 characters." },
  { icon: FileCheck2, title: "Read the breakdown", body: "See a verdict, a confidence score, and the eight aspects behind it." },
  { icon: Landmark, title: "Confirm at the source", body: "Open the official portal that publishes primary information on that subject." },
];

function Landing() {
  return (
    <AppShell>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="eyebrow">Media literacy · Public interest demonstration</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.06] sm:text-5xl">
              Check the claim.
              <span className="block text-muted-foreground">Then check the source.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              FNDVS analyses news text across eight credibility aspects, attaches a confidence
              score, and points you to the official Indian body that publishes authoritative
              information on that subject — so no verdict is ever a black box.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/submit">Verify a claim</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sources">Browse official sources</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Free and open — no account required. Analysis is produced by a documented
              demonstration engine and is not a substitute for professional fact-checking.
            </p>
          </div>

          <div className="surface p-6">
            <p className="eyebrow">Sample report</p>
            <p className="mt-3 rounded-lg bg-muted p-3 text-sm leading-relaxed">
              “SHOCKING: Doctors hate this miracle cure they don't want you to know about — share
              before it is deleted!!!”
            </p>
            <div className="mt-5 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-fake/30 bg-fake-soft px-4 py-2 font-display font-bold text-fake">
                <ShieldCheck className="size-4" aria-hidden="true" /> LIKELY FAKE
              </span>
              <span className="font-display text-3xl font-bold tabular-nums">94.2%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[94%] rounded-full bg-fake" />
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              {[
                ["Sensational vocabulary", "Concern"],
                ["Urgency & forwarding pressure", "Concern"],
                ["Source attribution", "Concern"],
                ["Factual specificity", "Caution"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className={v === "Concern" ? "font-semibold text-fake" : "font-semibold text-caution"}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Confirm at
            </p>
            <p className="mt-1 text-sm">
              PIB Fact Check · Ministry of Health &amp; Family Welfare · ICMR
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold sm:text-3xl">What every report gives you</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((f) => (
            <div key={f.title} className="surface p-6">
              <f.icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">The eight aspects we check</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Each aspect is scored independently from 0 to 100 and reported with the evidence that
            produced it.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {aspects.map((a, i) => (
              <li key={a} className="rounded-lg border border-border bg-background p-4">
                <span className="font-display text-sm font-bold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-1 font-medium">{a}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="surface p-6">
              <span className="eyebrow">Step {i + 1}</span>
              <s.icon className="mt-3 size-6 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">Authoritative sources in the registry</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Reports link directly to the primary publisher for the subject detected in your text.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {OFFICIAL_SOURCES.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
                >
                  {s.shortName} <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <Button className="mt-8" asChild>
            <Link to="/sources">View the full source directory</Link>
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
