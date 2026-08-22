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

function HelpPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Help"
          title="Methodology & guidance"
          description="How to read a report, and what the portal can and cannot tell you."
        />

        <dl className="mt-8 space-y-4">
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
