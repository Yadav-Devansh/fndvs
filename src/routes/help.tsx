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
          "How FNDVS scores credibility: the eight aspects, what the confidence bands mean, and how to cross-check a claim with official Indian sources.",
      },
      { property: "og:title", content: "Help & methodology — FNDVS" },
      { property: "og:description", content: "Understand the verdict, the score and the sources." },
    ],
  }),
});

const faqs = [
  {
    q: "What does the verdict actually mean?",
    a: "“Likely fake” means the text carries linguistic markers common to misinformation — hype vocabulary, forwarding pressure, missing attribution. “Likely genuine” means it reads like conventional sourced reporting. Neither is a statement of fact about the underlying event.",
  },
  {
    q: "How should I read the confidence score?",
    a: "80% and above is strong signal, 60–79% is moderate, and anything below 60% is explicitly flagged as low confidence. A low-confidence result means the text was too short, too neutral or too mixed for the engine to commit.",
  },
  {
    q: "What are the eight aspects?",
    a: "Sensational vocabulary, source attribution, emotional tone, urgency and forwarding pressure, factual specificity, writing-style integrity, clickbait framing, and the official corroboration path. Each is scored 0–100 with the evidence shown.",
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
    title: "Screenshots and the Gemini second opinion",
    intro:
      "Most people never retype a forwarded message, so the verify page also accepts a picture, and every report carries two independent reads of the claim.",
    steps: [
      "On Verify a claim, drop in a screenshot of an article, a social post or a WhatsApp forward (PNG, JPG or WebP up to 8 MB), then press “Extract text from image”. The claim text appears in the box, where you can edit it before running the check.",
      "If the picture has no readable claim in it, you'll be asked to type the claim instead — the rest of the flow is unchanged.",
      "The report opens on the Final inference panel: the rule-based verdict on the left, the Gemini verdict on the right, and one plain sentence saying whether they agree.",
      "Open the Gemini analysis tab and press “Run Gemini analysis” for its verdict, confidence, what it noticed and what you should check next. The answer is saved with the report, so it doesn't re-run each visit.",
      "When the two disagree, that's the interesting case: one judges how the claim is written, the other reasons about what it says. Gemini has no live internet access here, so finish with the official sources in the rule-based tab.",
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

  {
    title: "DWM Analytics — how to use it",
    intro:
      "The DWM page is the data-warehousing and mining companion. It treats every verification record as a fact row and lets you slice, cluster and export it.",
    steps: [
      "Verify a few claims first — the warehouse is built from your own local records, so the page is empty until there is data.",
      "The ETL stage cleans and transforms each record into a star-schema fact table with date, verdict, topic and aspect dimensions.",
      "Use the OLAP controls to roll up, drill down, slice and dice — for example verdict by topic, or confidence band by day.",
      "The K-Means panel clusters records by their aspect scores so you can see natural groupings of misinformation styles.",
      "Insights summarise the strongest patterns in plain language; use Export to download the warehouse for a report or a viva.",
    ],
    demo: "Demonstration tip: submit six to eight contrasting claims (health, finance, disaster, political) before the presentation, then show the OLAP cube and the clusters — the groupings become visually obvious and make the mining step easy to explain.",
  },
];

function HelpPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Help"
          title="Methodology & guidance"
          description="How to read a report, how to run the AI Search and DWM labs, and what the portal can and cannot tell you."
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
          <Button variant="outline" asChild>
            <Link to="/dwm">Open DWM Analytics</Link>
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

