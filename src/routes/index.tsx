import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileCheck2, GitBranch, Landmark, ShieldCheck } from "lucide-react";
import { predict } from "@/lib/predict";
import { LabelBadge } from "@/components/PredictionUI";

const SAMPLE_TEXT = "SHOCKING: Doctors hate this miracle cure they don't want you to know about — share before it is deleted!!!";
const SAMPLE = predict(SAMPLE_TEXT);

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({ meta: [
    { title: "FNDVS — Fake News Detection & Verification System" },
    { name: "description", content: "An academic project combining wording-risk analysis, independent Gemini opinions, image text extraction, and a search-algorithm planning lab." },
    { property: "og:title", content: "FNDVS — Fake News Detection & Verification System" },
    { property: "og:description", content: "Explore claim analysis and AI search planning, with clear explanations and honest limits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

function Landing() {
  return (
    <AppShell>
      <div className="academic-blueprint mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
        <header className="text-center">
          <ShieldCheck className="mx-auto size-9 text-chart-5" aria-hidden="true" />
          <p className="eyebrow mt-4">Independent academic project</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">FNDVS</h1>
          <p className="mt-2 text-lg font-medium">Fake News Detection &amp; Verification System</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Wording-based claim analysis and an independent Gemini opinion, paired with a lab for exploring AI search algorithms.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/submit"><FileCheck2 /> Verify a claim</Link></Button>
            <Button asChild variant="outline"><Link to="/ai-search"><GitBranch /> AI Search lab</Link></Button>
          </div>
        </header>

        <section className="mt-10 grid gap-6 border-y border-border py-7 md:grid-cols-3" aria-label="Project areas">
          <div className="space-y-3">
            <FileCheck2 className="size-5 text-chart-5" aria-hidden="true" />
            <h2 className="text-base font-semibold">Claim analysis</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Text or screenshot → wording-risk signals and Gemini’s separate assessment.</p>
            <Link to="/submit" className="inline-flex items-center gap-2 text-sm font-medium text-primary">Open claim check <ArrowRight className="size-4" /></Link>
          </div>
          <div className="space-y-3 md:border-l md:border-border md:pl-6">
            <GitBranch className="size-5 text-real" aria-hidden="true" />
            <h2 className="text-base font-semibold">AI Search lab</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Compare BFS, UCS and A* through a check plan, readable tree and inference.</p>
            <Link to="/ai-search" className="inline-flex items-center gap-2 text-sm font-medium text-primary">Explore the lab <ArrowRight className="size-4" /></Link>
          </div>
          <div className="space-y-3 md:border-l md:border-border md:pl-6">
            <Landmark className="size-5 text-caution" aria-hidden="true" />
            <h2 className="text-base font-semibold">Official source directory</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Links to Indian public-information desks for your own confirmation.</p>
            <Link to="/sources" className="inline-flex items-center gap-2 text-sm font-medium text-primary">Browse sources <ArrowRight className="size-4" /></Link>
          </div>
        </section>

        <section className="py-7" aria-label="Sample wording analysis">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">A sample wording check</h2>
            <div className="flex flex-wrap items-center gap-3"><LabelBadge label={SAMPLE.verdict} /><span className="font-mono text-sm">{SAMPLE.riskScore}/100 risk</span></div>
          </div>
          <blockquote className="mt-4 border-l-2 border-caution pl-4 text-sm leading-relaxed text-muted-foreground">“{SAMPLE_TEXT}”</blockquote>
          <p className="mt-4 text-xs text-muted-foreground">Wording can raise suspicion, not establish truth. Gemini gives a separate opinion—not a live fact-check.</p>
        </section>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <span>No account required · Records stay in this browser</span>
          <Link to="/help" className="inline-flex items-center gap-2 font-medium text-primary">Project guide <ArrowRight className="size-3" /></Link>
        </div>
      </div>
    </AppShell>
  );
}
