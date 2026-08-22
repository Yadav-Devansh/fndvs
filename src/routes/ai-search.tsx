import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Play, RotateCcw } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { predict } from "@/lib/predict";
import {
  ALGORITHMS,
  buildStateSpace,
  runAlgorithm,
  runAll,
  stateLabel,
  type AlgorithmId,
} from "@/lib/ai";
import { useRecords } from "./history";

export const Route = createFileRoute("/ai-search")({
  component: AiSearchPage,
  head: () => ({
    meta: [
      { title: "AI search lab — verification path finding | FNDVS" },
      {
        name: "description",
        content:
          "Explore how BFS, Best First Search, Hill Climbing and A* search the FNDVS verification state space to find the cheapest path to an official Indian source.",
      },
      { property: "og:title", content: "AI search lab — verification path finding | FNDVS" },
      {
        property: "og:description",
        content:
          "Step through classical AI search algorithms exploring verification-source paths for any news claim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SAMPLE =
  "URGENT: Forward this to 10 people immediately — the government is switching off all mobile SIM cards that are not linked to Aadhaar by Friday!";

function AiSearchPage() {
  const records = useRecords();
  const [text, setText] = useState(SAMPLE);
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [analysed, setAnalysed] = useState(SAMPLE);
  const [stepIndex, setStepIndex] = useState(0);

  const graph = useMemo(() => buildStateSpace(predict(analysed)), [analysed]);
  const result = useMemo(() => runAlgorithm(algorithm, graph), [algorithm, graph]);
  const comparison = useMemo(() => runAll(graph), [graph]);

  useEffect(() => setStepIndex(0), [algorithm, analysed]);

  const step = result.steps[Math.min(stepIndex, result.steps.length - 1)];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <PageHeader
          eyebrow="Classical AI lab"
          title="Verification path search"
          description="The detection engine is untouched here. These algorithms only search the ORDER of verification actions — which aspect to check next, when to consult an official desk — over a state space built from the claim's own FNDVS scores."
        />

        {/* Claim input */}
        <section className="surface mt-8 p-5">
          <Label htmlFor="claim" className="text-sm font-semibold">
            Claim to explore
          </Label>
          <Textarea
            id="claim"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mt-2"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => setAnalysed(text.trim() || SAMPLE)}>
              <Play className="size-4" aria-hidden="true" /> Build state space
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setText(SAMPLE);
                setAnalysed(SAMPLE);
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Reset
            </Button>
            {records.length > 0 && (
              <Select
                onValueChange={(id) => {
                  const rec = records.find((r) => r.id === id);
                  if (rec) {
                    setText(rec.text);
                    setAnalysed(rec.text);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Load a saved record" />
                </SelectTrigger>
                <SelectContent>
                  {records.slice(0, 20).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.result.label} · {r.text.slice(0, 48)}…
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </section>

        {/* Algorithm picker */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALGORITHMS.map((a) => {
            const active = a.id === algorithm;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAlgorithm(a.id)}
                aria-pressed={active}
                className={`surface p-4 text-left transition ${
                  active ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
                }`}
              >
                <p className="font-display text-sm font-bold">{a.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.type}</p>
              </button>
            );
          })}
        </section>

        {/* Result summary */}
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { k: "Path length", v: `${result.pathLength} actions` },
            { k: "Search cost", v: `${result.searchCost}` },
            { k: "States explored", v: `${result.nodesExplored}` },
            { k: "Goal reached", v: result.goalReached ? "Yes" : "No (halted)" },
          ].map((m) => (
            <div key={m.k} className="surface p-4">
              <p className="eyebrow">{m.k}</p>
              <p className="mt-1 font-display text-xl font-bold">{m.v}</p>
            </div>
          ))}
        </section>

        <p className="mt-4 rounded-lg border border-border bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
          {result.note}
        </p>

        {/* Path */}
        <section className="surface mt-6 p-5">
          <h2 className="font-display text-lg font-bold">Verification path found</h2>
          <ol className="mt-3 flex flex-wrap items-center gap-2">
            {result.path.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No complete path — the search halted before the goal state.
              </li>
            )}
            {result.path.map((id, i) => (
              <li key={id} className="flex items-center gap-2">
                <span className="rounded border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  {stateLabel(graph, id)}
                </span>
                {i < result.path.length - 1 && (
                  <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Step trace */}
        {step && (
          <section className="surface mt-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">
                Step {step.index + 1} of {result.steps.length}
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  disabled={stepIndex === 0}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" /> Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepIndex((i) => Math.min(result.steps.length - 1, i + 1))}
                  disabled={stepIndex >= result.steps.length - 1}
                >
                  Next <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <p className="mt-3 text-sm">{step.note}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="eyebrow">Frontier</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {step.frontier.length === 0 && (
                    <span className="text-xs text-muted-foreground">empty</span>
                  )}
                  {step.frontier.map((id) => (
                    <span
                      key={id}
                      className="rounded border border-border px-2 py-0.5 text-[11px]"
                    >
                      {graph.byId[id]?.code ?? id}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow">Explored</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {step.explored.map((id) => (
                    <span
                      key={id}
                      className="rounded border border-border bg-muted px-2 py-0.5 text-[11px]"
                    >
                      {graph.byId[id]?.code ?? id}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {step.candidates.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2">Candidate state</th>
                      <th className="py-2">g(n)</th>
                      <th className="py-2">h(n)</th>
                      <th className="py-2">f(n)</th>
                      <th className="py-2">Promise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.candidates.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-b border-border/60 ${
                          c.selected ? "bg-primary/10 font-medium" : ""
                        }`}
                      >
                        <td className="py-2">{c.label}</td>
                        <td className="py-2">{c.g}</td>
                        <td className="py-2">{c.h}</td>
                        <td className="py-2">{c.f}</td>
                        <td className="py-2">{c.promise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Comparison */}
        <section className="surface mt-6 p-5">
          <h2 className="font-display text-lg font-bold">Algorithm comparison</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Algorithm</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Steps</th>
                  <th className="py-2">Cost</th>
                  <th className="py-2">Explored</th>
                  <th className="py-2">Goal</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r) => (
                  <tr
                    key={r.algorithm}
                    className={`border-b border-border/60 ${
                      r.algorithm === algorithm ? "bg-primary/10 font-medium" : ""
                    }`}
                  >
                    <td className="py-2">{r.algorithmName}</td>
                    <td className="py-2 text-muted-foreground">{r.searchType}</td>
                    <td className="py-2">{r.pathLength}</td>
                    <td className="py-2">{r.searchCost}</td>
                    <td className="py-2">{r.nodesExplored}</td>
                    <td className="py-2">{r.goalReached ? "reached" : "halted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* State space reference */}
        <section className="surface mt-6 p-5">
          <h2 className="font-display text-lg font-bold">State space & heuristic</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {graph.states.map((s) => {
              const h = graph.heuristics[s.id];
              return (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">
                    {s.code} · {s.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
                  {h && (
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      promise {h.promise} · h(n) {h.hCost} · {h.stepsToGoal} step(s) to goal
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-8 rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
          These searches order verification work; they never decide whether a claim is true. Always
          read the primary publication on the official portal before drawing a conclusion.
        </p>
      </div>
    </AppShell>
  );
}
