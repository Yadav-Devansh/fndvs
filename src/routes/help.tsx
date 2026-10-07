import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/PredictionUI";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({
    meta: [
      { title: "Help & methodology — FNDVS" },
      {
        name: "description",
        content:
          "How FNDVS scores credibility: the linguistic risk signals, what the risk score means, and how to cross-check a claim with official Indian sources.",
      },
      { property: "og:title", content: "Help & methodology — FNDVS" },
      { property: "og:description", content: "Understand the verdict, the score and the sources." },
    ],
  }),
});

const faqs = [
  {
    q: "What does the verdict actually mean?",
    a: "The rule engine reads wording only, not facts. “Likely misleading” means strong risk signals plus pressure to forward. Everything else is “Unverified” — the wording check can never call a claim credible. Naming a ministry or saying “according to” is treated as a claim to check, not as proof.",
  },
  {
    q: "How should I read the risk score?",
    a: "The risk score (0–100) measures how much the wording looks like a forwarded hoax. 60+ is high language risk, 25–59 medium, below 25 low. Evidence strength is at most “weak” from wording alone. Non-English text gets “unknown”.",
  },
  {
    q: "What signals are checked?",
    a: "Sensational vocabulary, claimed attribution, emotional tone, urgency and forwarding pressure, checkable details, writing style and clickbait framing. Corroboration shows “Not checked yet” for now. If the text is itself debunking a rumour, you are told to verify the original claim instead.",
  },
  {
    q: "Why does it show government websites?",
    a: "Language analysis alone can never confirm a fact. FNDVS detects the subject area of your text and routes you to the Indian bodies that publish primary information on it — PIB Fact Check, NITI Aayog, MoHFW, ICMR, RBI, MoSPI, IMD, NDMA, ISRO, ECI, MeitY, CERT-In, UIDAI and others.",
  },
  {
    q: "Do I need an account?",
    a: "No. The portal is open to everyone, and your verification records stay in your own browser's local storage. Nothing is sent to an account or a third party.",
  },
  {
    q: "Is this an official government service?",
    a: "No. FNDVS is an independent academic demonstration. The organisations and links it references are genuine, but the analysis engine is a documented mock model built for teaching purposes.",
  },
];

const guides = [
  {
    title: "Screenshots and the evidence-based verdict",
    intro:
      "The verify page accepts a picture, and every report is decided from published evidence — not from opinions agreeing.",
    steps: [
      "On Verify a claim, drop in a screenshot (PNG, JPG or WebP up to 8 MB) and press “Extract text from image”. Edit the text if needed, then run the check.",
      "The report looks up published fact-checks and recent coverage from reputable outlets automatically.",
      "A fact-check rated false or misleading gives “Likely misleading”. A fact-check rated true, or the same claim reported by at least two reputable outlets, gives “Likely credible”. Anything else stays “Unverified”.",
      "Gemini reads only the evidence that was found and must cite it. It can raise or lower confidence but can never make a claim credible by itself.",
      "Wording signals (tone, urgency, forward-chains) are shown separately as language risk — they describe how a claim is written, not whether it is true.",
    ],
    demo: "Demonstration tip: keep one screenshot of a sensational forward ready. Extract it live, run the check, then run Gemini — a disagreement between the two engines is the strongest talking point you can show.",
  },
  {
    title: "AI Search lab — how to use it",
    intro:
      "The AI Search page answers one question: for this claim, in what order should we do the verification checks? It compares an uninformed search (BFS) with an informed one (A*). It never decides whether a claim is true.",
    steps: [
      "Paste a claim (or load a saved record) and press “Run search”. The FNDVS scores become the action costs and heuristic values of the state space.",
      "Read the two cards: BFS versus A*. Compare states explored, plan length, total effort and runtime — the sentence below them states exactly what the heuristic saved.",
      "Switch the graph between BFS and A* to see the two plans highlighted on the same state space. Click any box for the node inspector (exact move, cost, parents and children).",
      "Press “Animate the plan” and read the numbered plan underneath — it is the human-readable order of verification work.",
      "Only if asked: open Advanced settings for the other two algorithms, search limits, heuristic weights, the step-by-step trace with g(n)/h(n)/f(n), and the four-algorithm table.",
    ],
    demo: "Demonstration script (about two minutes): run the sample claim, point at the two cards and say “both find the goal, A* looks at fewer states”, switch the graph BFS → A* to show the different routes, animate the A* plan, then open Advanced and lower max depth to 3 to show the limits and Hill Climbing stopping at a local maximum.",
  },

];

function HelpPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Help"
          title="Methodology & guidance"
          description="How to read a report, how to run the AI Search lab, and what the portal can and cannot tell you."
        />

        <section className="mt-8 space-y-6">
          {guides.map((g) => (
            <article key={g.title} className="surface p-6">
              <h2 className="font-display text-lg font-bold">{g.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.intro}</p>
              <ol className="mt-4 space-y-2">
                {g.steps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                {g.demo}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/ai-search">Open AI Search lab</Link>
          </Button>
        </div>


        <h2 className="mt-10 font-display text-lg font-bold">Frequently asked questions</h2>
        <dl className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="surface p-6">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/submit">Verify a claim</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sources">Official source directory</Link>
          </Button>
        </div>

        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </AppShell>
  );
}

