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
import { predict } from "@/lib/predict";
import { LabelBadge } from "@/components/PredictionUI";

const SAMPLE_TEXT =
  "SHOCKING: Doctors hate this miracle cure they don't want you to know about — share before it is deleted!!!";
/** Real engine output for the sample, computed at render — no hard-coded numbers. */
const SAMPLE = predict(SAMPLE_TEXT);

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "FNDVS — Check a news claim against official Indian sources" },
      {
        name: "description",
        content:
          "Paste any headline or forwarded message. FNDVS checks the wording for risk signals and points you to the official Indian source — PIB Fact Check, NITI Aayog, RBI, IMD and more — to confirm it against.",
      },
      { property: "og:title", content: "FNDVS — Verify news against official Indian sources" },
      {
        property: "og:description",
        content:
          "Checks wording for risk signals and links you to authoritative Indian government desks to confirm the facts.",
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
  "Corroboration (not checked yet)",
];

const pillars = [
  {
    icon: ListTree,
    title: "Linguistic risk signals",
    body: "Each report reads the wording — tone, pressure, framing — and shows the exact words behind every flag. It reads wording, not facts.",
  },
  {
    icon: Gauge,
    title: "Honest about limits",
    body: "The wording check alone never calls a claim credible. At most it flags a message as likely misleading; everything else stays unverified until you confirm it.",
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
  { icon: FileCheck2, title: "Read the breakdown", body: "See the language risk, the signals behind it, and what to check next." },
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
              FNDVS checks the wording of a claim for risk signals, looks for where it should be
              confirmed, and points you to the official Indian body that publishes authoritative
              information on that subject — so nothing is a black box.
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
            <p className="eyebrow">Sample report · live engine output</p>
            <p className="mt-3 rounded-lg bg-muted p-3 text-sm leading-relaxed">“{SAMPLE_TEXT}”</p>
            <div className="mt-5 flex items-center justify-between">
              <LabelBadge label={SAMPLE.verdict} size="lg" />
              <span className="font-display text-3xl font-bold tabular-nums">
                {SAMPLE.riskScore}
                <span className="ml-1 text-sm font-medium text-muted-foreground">risk score</span>
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-fake" style={{ width: `${SAMPLE.riskScore}%` }} />
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              {SAMPLE.aspects
                .filter((a) => a.verdict === "fail" || a.verdict === "warn")
                .slice(0, 4)
                .map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{a.label}</dt>
                    <dd className={a.verdict === "fail" ? "font-semibold text-fake" : "font-semibold text-caution"}>
                      {a.verdict === "fail" ? "Concern" : "Caution"}
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
