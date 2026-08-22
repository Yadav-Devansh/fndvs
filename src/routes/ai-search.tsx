import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StateGraph } from "@/components/ai/StateGraph";
import { predict } from "@/lib/predict";
import {
  ALGORITHMS,
  DEFAULT_HEURISTIC_WEIGHTS,
  DEFAULT_OPTIONS,
  buildStateSpace,
  runAlgorithm,
  stateLabel,
  type AlgorithmId,
  type HeuristicWeights,
  type SearchOptions,
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

const WEIGHT_FIELDS: { key: keyof HeuristicWeights; label: string }[] = [
  { key: "topicRelevance", label: "Topic relevance" },
  { key: "sourceRelevance", label: "Source relevance" },
  { key: "credibilityConcern", label: "Credibility concern" },
  { key: "evidenceAvailability", label: "Evidence availability" },
  { key: "uncertaintyReduction", label: "Uncertainty reduction" },
];

function AiSearchPage() {
  const records = useRecords();
  const [text, setText] = useState(SAMPLE);
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [analysed, setAnalysed] = useState(SAMPLE);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  // Draft controls (edited by the user) vs applied settings (used by the search).
  const [draftOptions, setDraftOptions] = useState<SearchOptions>({ ...DEFAULT_OPTIONS });
  const [options, setOptions] = useState<SearchOptions>({ ...DEFAULT_OPTIONS });
  const [draftWeights, setDraftWeights] = useState<HeuristicWeights>({
    ...DEFAULT_HEURISTIC_WEIGHTS,
  });
  const [weights, setWeights] = useState<HeuristicWeights>({ ...DEFAULT_HEURISTIC_WEIGHTS });
  const [compare, setCompare] = useState<AlgorithmId[]>(ALGORITHMS.map((a) => a.id));

  const graph = useMemo(() => buildStateSpace(predict(analysed), weights), [analysed, weights]);
  const result = useMemo(
    () => runAlgorithm(algorithm, graph, options),
    [algorithm, graph, options],
  );
  const comparison = useMemo(
    () => compare.map((id) => runAlgorithm(id, graph, options)),
    [compare, graph, options],
  );

  useEffect(() => setStepIndex(0), [algorithm, analysed, options, weights]);

  const step = result.steps[Math.min(stepIndex, result.steps.length - 1)];
  const inspected = selectedState ? graph.byId[selectedState] : undefined;
  const inspectedH = selectedState ? graph.heuristics[selectedState] : undefined;

  const applySettings = () => {
    setOptions({ ...draftOptions });
    setWeights({ ...draftWeights });
  };
  const resetSettings = () => {
    setDraftOptions({ ...DEFAULT_OPTIONS });
    setDraftWeights({ ...DEFAULT_HEURISTIC_WEIGHTS });
    setOptions({ ...DEFAULT_OPTIONS });
    setWeights({ ...DEFAULT_HEURISTIC_WEIGHTS });
  };

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

        {/* Search controls */}
        <section className="surface mt-6 p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold">Search controls</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Limits apply to every algorithm; heuristic weights rebuild h(n) and the promise score.
          </p>

          <div className="mt-4 grid gap-5 md:grid-cols-3">
            {(
              [
                { key: "maxDepth", label: "Max depth", min: 1, max: 12 },
                { key: "maxIterations", label: "Max iterations", min: 1, max: 200 },
                { key: "maxFrontier", label: "Max frontier size", min: 1, max: 50 },
              ] as const
            ).map((c) => (
              <div key={c.key}>
                <div className="flex items-baseline justify-between">
                  <Label className="text-sm">{c.label}</Label>
                  <span className="font-display text-sm font-bold">{draftOptions[c.key]}</span>
                </div>
                <Slider
                  className="mt-3"
                  min={c.min}
                  max={c.max}
                  step={1}
                  value={[draftOptions[c.key]]}
                  onValueChange={([v]) =>
                    setDraftOptions((o) => ({ ...o, [c.key]: v ?? o[c.key] }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {WEIGHT_FIELDS.map((w) => (
              <div key={w.key}>
                <div className="flex items-baseline justify-between">
                  <Label className="text-sm">{w.label}</Label>
                  <span className="font-display text-sm font-bold">
                    {draftWeights[w.key].toFixed(2)}
                  </span>
                </div>
                <Slider
                  className="mt-3"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[draftWeights[w.key]]}
                  onValueChange={([v]) =>
                    setDraftWeights((s) => ({ ...s, [w.key]: v ?? s[w.key] }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={applySettings}>
              <Play className="size-4" aria-hidden="true" /> Re-run all algorithms
            </Button>
            <Button variant="outline" onClick={resetSettings}>
              <RotateCcw className="size-4" aria-hidden="true" /> Restore defaults
            </Button>
          </div>
        </section>

        {/* Result summary */}
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { k: "Path length", v: `${result.pathLength} actions` },
            { k: "Search cost", v: `${result.searchCost}` },
            { k: "Expansions", v: `${result.expansions}` },
            { k: "Runtime", v: `${result.runtimeMs.toFixed(2)} ms` },
          ].map((m) => (
            <div key={m.k} className="surface p-4">
              <p className="eyebrow">{m.k}</p>
              <p className="mt-1 font-display text-xl font-bold">{m.v}</p>
            </div>
          ))}
        </section>

        <p className="mt-4 rounded-lg border border-border bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
          {result.note}
          {result.limitHit ? ` Limit applied: ${result.limitHit}` : ""}
        </p>

        {/* Graph view */}
        <section className="surface mt-6 p-5">
          <h2 className="font-display text-lg font-bold">State space graph</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Highlighted edges are the chosen path for {result.algorithmName}. Click any state to
            inspect it, double-click to collapse or expand its branch.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-primary bg-primary/15" />
              on path
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-border bg-muted" />
              explored
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-border bg-caution-soft" />
              frontier
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border-2 border-caution" />
              current / animating
            </span>
          </div>

          {/* Layout & filter controls */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-border bg-muted/50 p-3">
            {(
              [
                ["showExplored", "Show explored"],
                ["showFrontier", "Show frontier"],
                ["showUnvisited", "Show unvisited"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters[key]}
                  onCheckedChange={(v) => setFilters((f) => ({ ...f, [key]: Boolean(v) }))}
                />
                {label}
              </label>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={animating ? "default" : "outline"}
                onClick={() => {
                  if (animating) {
                    setAnimating(false);
                  } else if (result.path.length) {
                    setAnimIndex(0);
                    setAnimating(true);
                  }
                }}
                disabled={result.path.length === 0}
              >
                {animating ? (
                  <Pause className="size-4" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {animating ? "Pause walk-through" : "Animate path"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAnimating(false);
                  setAnimIndex(-1);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Stop
              </Button>
              {collapsed.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setCollapsed([])}>
                  Expand all ({collapsed.length})
                </Button>
              )}
            </div>
          </div>

          {animIndex >= 0 && result.path[animIndex] && (
            <p className="mt-3 rounded-lg border border-caution bg-caution-soft p-3 text-sm">
              <span className="font-semibold">
                Step {animIndex + 1} of {result.path.length}:
              </span>{" "}
              {animIndex === 0
                ? `Start at ${stateLabel(graph, result.path[0]!)}.`
                : `${edgeBetween(graph, result.path[animIndex - 1]!, result.path[animIndex]!)?.action ?? "Move"} → ${stateLabel(graph, result.path[animIndex]!)}`}
            </p>
          )}

          <div className="mt-4">
            <StateGraph
              graph={graph}
              path={result.path}
              explored={step?.explored ?? []}
              frontier={step?.frontier ?? []}
              {...(step ? { currentId: step.current } : {})}
              {...(selectedState ? { selectedId: selectedState } : {})}
              onSelect={setSelectedState}
              filters={filters}
              collapsed={collapsed}
              onToggleCollapse={(id) =>
                setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
              }
              animateIndex={animIndex}
            />
          </div>

          {/* Node inspector */}
          {inspected && (
            <div className="mt-4 rounded-lg border border-border bg-muted/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{inspected.kind} state</p>
                  <p className="font-display text-base font-bold">
                    {inspected.code} · {inspected.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{inspected.detail}</p>
                </div>
                <div className="flex gap-2">
                  {(graph.edges[inspected.id] ?? []).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCollapsed((c) =>
                          c.includes(inspected.id)
                            ? c.filter((x) => x !== inspected.id)
                            : [...c, inspected.id],
                        )
                      }
                    >
                      {collapsed.includes(inspected.id) ? "Expand branch" : "Collapse branch"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSelectedState(null)}>
                    Close
                  </Button>
                </div>
              </div>

              {/* Role on the chosen path */}
              <p className="mt-3 text-sm">
                {pathIndex >= 0 ? (
                  <>
                    On the chosen path as move{" "}
                    <span className="font-semibold">
                      #{pathIndex + 1} of {result.path.length}
                    </span>
                    .{" "}
                    {incomingPathEdge
                      ? `Reached by “${incomingPathEdge.action}” (cost ${incomingPathEdge.cost}) from ${stateLabel(graph, result.path[pathIndex - 1]!)}.`
                      : "This is the initial state."}{" "}
                    {outgoingPathEdge
                      ? `Next move: “${outgoingPathEdge.action}” (cost ${outgoingPathEdge.cost}) → ${stateLabel(graph, result.path[pathIndex + 1]!)}.`
                      : "No further move — the path ends here."}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Not part of the chosen path for {result.algorithmName}.
                  </span>
                )}
              </p>

              {inspectedH && (
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Promise", inspectedH.promise],
                    ["h(n)", inspectedH.hCost],
                    ["Steps to goal", inspectedH.stepsToGoal],
                    ["Topic relevance", inspectedH.topicRelevance],
                    ["Source relevance", inspectedH.sourceRelevance],
                    ["Credibility concern", inspectedH.credibilityConcern],
                    ["Evidence availability", inspectedH.evidenceAvailability],
                    ["Uncertainty reduction", inspectedH.uncertaintyReduction],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded border border-border bg-card p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {k}
                      </p>
                      <p className="font-display text-sm font-bold">{v}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="eyebrow">Parents (incoming transitions)</p>
                  <ul className="mt-2 space-y-1.5">
                    {parentEdges.length === 0 && (
                      <li className="text-xs text-muted-foreground">
                        None — this is the start state.
                      </li>
                    )}
                    {parentEdges.map((e) => (
                      <li key={`${e.from}-${e.to}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedState(e.from)}
                          className="w-full rounded border border-border bg-card p-2 text-left text-xs hover:border-primary"
                        >
                          <span className="font-semibold">{stateLabel(graph, e.from)}</span>
                          <span className="block text-muted-foreground">
                            move: “{e.action}” · cost {e.cost}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">Children (outgoing transitions)</p>
                  <ul className="mt-2 space-y-1.5">
                    {(graph.edges[inspected.id] ?? []).length === 0 && (
                      <li className="text-xs text-muted-foreground">
                        None — this is the goal state.
                      </li>
                    )}
                    {(graph.edges[inspected.id] ?? []).map((e) => (
                      <li key={`${e.from}-${e.to}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedState(e.to)}
                          className="w-full rounded border border-border bg-card p-2 text-left text-xs hover:border-primary"
                        >
                          <span className="font-semibold">{stateLabel(graph, e.to)}</span>
                          <span className="block text-muted-foreground">
                            move: “{e.action}” · cost {e.cost} · h(n){" "}
                            {graph.heuristics[e.to]?.hCost ?? "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>


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
                <button
                  type="button"
                  onClick={() => setSelectedState(id)}
                  className="rounded border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:border-primary"
                >
                  {stateLabel(graph, id)}
                </button>
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
                      <th className="py-2">Status</th>
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
                        <td className="py-2 text-xs text-muted-foreground">
                          {c.pruned ? `pruned — ${c.pruned}` : c.selected ? "selected" : "queued"}
                        </td>
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
          <h2 className="font-display text-lg font-bold">Side-by-side comparison</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All selected algorithms run on the same claim with the same limits and heuristic
            weights.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            {ALGORITHMS.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={compare.includes(a.id)}
                  onCheckedChange={(v) =>
                    setCompare((list) =>
                      v ? [...new Set([...list, a.id])] : list.filter((x) => x !== a.id),
                    )
                  }
                />
                {a.name}
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {comparison.map((r) => {
              const avgPromise = r.path.length
                ? Math.round(
                    (r.path.reduce((s, id) => s + (graph.heuristics[id]?.promise ?? 0), 0) /
                      r.path.length) *
                      10,
                  ) / 10
                : 0;
              const goalH = graph.heuristics[graph.start]?.hCost ?? 0;
              return (
                <div
                  key={r.algorithm}
                  className={`rounded-lg border p-4 ${
                    r.algorithm === algorithm ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-base font-bold">{r.algorithmName}</p>
                    <span className="text-xs text-muted-foreground">{r.searchType}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    {[
                      ["Runtime", `${r.runtimeMs.toFixed(2)} ms`],
                      ["Expansions", r.expansions],
                      ["Path length", r.pathLength],
                      ["Search cost", r.searchCost],
                      ["Peak frontier", r.peakFrontier],
                      ["Goal", r.goalReached ? "reached" : "halted"],
                      ["Avg promise", avgPromise],
                      ["h(start)", goalH],
                      ["Max depth", r.maxDepth],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded border border-border bg-card p-2">
                        <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {k}
                        </dt>
                        <dd className="font-display text-sm font-bold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Path:{" "}
                    {r.path.length
                      ? r.path.map((id) => graph.byId[id]?.code ?? id).join(" → ")
                      : "no complete path"}
                  </p>
                  {r.limitHit && (
                    <p className="mt-2 text-xs text-caution-foreground">
                      <span className="rounded bg-caution px-1.5 py-0.5">{r.limitHit}</span>
                    </p>
                  )}
                </div>
              );
            })}
            {comparison.length === 0 && (
              <p className="text-sm text-muted-foreground">Select at least one algorithm.</p>
            )}
          </div>
        </section>

        {/* State space reference */}
        <section className="surface mt-6 p-5">
          <h2 className="font-display text-lg font-bold">State space & heuristic</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {graph.states.map((s) => {
              const h = graph.heuristics[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedState(s.id)}
                  className="rounded-lg border border-border p-3 text-left hover:border-primary"
                >
                  <p className="text-sm font-semibold">
                    {s.code} · {s.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
                  {h && (
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      promise {h.promise} · h(n) {h.hCost} · {h.stepsToGoal} step(s) to goal
                    </p>
                  )}
                </button>
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
