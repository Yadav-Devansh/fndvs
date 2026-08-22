import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

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
import { StateGraph, type GraphFilters } from "@/components/ai/StateGraph";
import { predict } from "@/lib/predict";
import {
  ALGORITHMS,
  DEFAULT_HEURISTIC_WEIGHTS,
  DEFAULT_OPTIONS,
  buildStateSpace,
  runAlgorithm,
  stateLabel,
  type AiGraph,
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
          "Compare BFS and A* searching the FNDVS verification state space to find the cheapest order of checks that reaches an official Indian source.",
      },
      { property: "og:title", content: "AI search lab — verification path finding | FNDVS" },
      {
        property: "og:description",
        content:
          "A simple BFS vs A* demonstration over verification-source paths for any news claim.",
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

function edgeBetween(graph: AiGraph, from: string, to: string) {
  return (graph.edges[from] ?? []).find((e) => e.to === to);
}

function AiSearchPage() {
  const records = useRecords();
  const [text, setText] = useState(SAMPLE);
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [analysed, setAnalysed] = useState(SAMPLE);
  const [advanced, setAdvanced] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>({
    showExplored: true,
    showFrontier: true,
    showUnvisited: true,
  });
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [animIndex, setAnimIndex] = useState(-1);
  const [animating, setAnimating] = useState(false);

  // Draft controls (edited by the user) vs applied settings (used by the search).
  const [draftOptions, setDraftOptions] = useState<SearchOptions>({ ...DEFAULT_OPTIONS });
  const [options, setOptions] = useState<SearchOptions>({ ...DEFAULT_OPTIONS });
  const [draftWeights, setDraftWeights] = useState<HeuristicWeights>({
    ...DEFAULT_HEURISTIC_WEIGHTS,
  });
  const [weights, setWeights] = useState<HeuristicWeights>({ ...DEFAULT_HEURISTIC_WEIGHTS });

  const graph = useMemo(() => buildStateSpace(predict(analysed), weights), [analysed, weights]);
  const result = useMemo(
    () => runAlgorithm(algorithm, graph, options),
    [algorithm, graph, options],
  );
  const bfsResult = useMemo(() => runAlgorithm("bfs", graph, options), [graph, options]);
  const astarResult = useMemo(() => runAlgorithm("astar", graph, options), [graph, options]);
  const comparison = useMemo(
    () => ALGORITHMS.map((a) => runAlgorithm(a.id, graph, options)),
    [graph, options],
  );

  useEffect(() => setStepIndex(0), [algorithm, analysed, options, weights]);
  useEffect(() => {
    setAnimating(false);
    setAnimIndex(-1);
  }, [algorithm, analysed, options, weights]);

  // Walk-through animation over the chosen path.
  useEffect(() => {
    if (!animating) return;
    const timer = window.setInterval(() => {
      setAnimIndex((i) => {
        if (i >= result.path.length - 1) {
          setAnimating(false);
          return i;
        }
        return i + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [animating, result.path.length]);

  useEffect(() => {
    if (animIndex >= 0 && result.path[animIndex]) setSelectedState(result.path[animIndex]!);
  }, [animIndex, result.path]);

  const step = result.steps[Math.min(stepIndex, result.steps.length - 1)];
  const inspected = selectedState ? graph.byId[selectedState] : undefined;
  const inspectedH = selectedState ? graph.heuristics[selectedState] : undefined;
  const pathIndex = selectedState ? result.path.indexOf(selectedState) : -1;
  const incomingPathEdge =
    pathIndex > 0
      ? edgeBetween(graph, result.path[pathIndex - 1]!, result.path[pathIndex]!)
      : undefined;
  const outgoingPathEdge =
    pathIndex >= 0 && pathIndex < result.path.length - 1
      ? edgeBetween(graph, result.path[pathIndex]!, result.path[pathIndex + 1]!)
      : undefined;
  const parentEdges = useMemo(
    () =>
      selectedState
        ? graph.states.flatMap((s) =>
            (graph.edges[s.id] ?? []).filter((e) => e.to === selectedState),
          )
        : [],
    [graph, selectedState],
  );

  const savedStates = bfsResult.nodesExplored - astarResult.nodesExplored;
  const savedCost = Math.round((bfsResult.searchCost - astarResult.searchCost) * 10) / 10;

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

  const summaryCard = (r: typeof bfsResult, blurb: string) => (
    <button
      type="button"
      onClick={() => setAlgorithm(r.algorithm)}
      aria-pressed={algorithm === r.algorithm}
      className={`surface p-5 text-left transition ${
        algorithm === r.algorithm ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-base font-bold">{r.algorithmName}</p>
        <span className="text-xs text-muted-foreground">{r.searchType}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {[
          ["States explored", `${r.nodesExplored}`, "checks the search had to look at"],
          ["Path length", `${r.pathLength} actions`, "steps in the plan it returned"],
          ["Total effort", `${r.searchCost}`, "sum of action costs on that plan"],
          ["Runtime", `${r.runtimeMs.toFixed(2)} ms`, "time to compute"],
        ].map(([k, v, cap]) => (
          <div key={k} className="rounded border border-border bg-card p-2">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className="font-display text-lg font-bold">{v}</dd>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{cap}</p>
          </div>
        ))}
      </dl>
    </button>
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <PageHeader
          eyebrow="Classical AI lab"
          title="Which checks should we do first?"
          description="The detection engine is untouched. This page only searches the ORDER of verification actions — which aspect to check next, when to consult an official desk — and compares an uninformed search (BFS) with an informed one (A*)."
        />

        {/* 1. Claim input */}
        <section className="surface mt-8 p-5">
          <Label htmlFor="claim" className="text-sm font-semibold">
            Claim to verify
          </Label>
          <Textarea
            id="claim"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="mt-2"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => setAnalysed(text.trim() || SAMPLE)}>
              <Play className="size-4" aria-hidden="true" /> Run search
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

        {/* 2. BFS vs A* */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {summaryCard(
            bfsResult,
            "Uninformed — tries every check at the current depth before going deeper.",
          )}
          {summaryCard(
            astarResult,
            "Informed — uses cost so far plus a heuristic estimate of what is left.",
          )}
        </section>
        <p className="mt-3 rounded-lg border border-border bg-muted p-4 text-sm leading-relaxed">
          {bfsResult.goalReached && astarResult.goalReached ? (
            <>
              Both reach the same goal state. A* explored{" "}
              <span className="font-semibold">
                {savedStates > 0 ? `${savedStates} fewer` : `${Math.abs(savedStates)} more`}
              </span>{" "}
              states and its plan costs{" "}
              <span className="font-semibold">
                {savedCost > 0 ? `${savedCost} less effort` : `${Math.abs(savedCost)} more effort`}
              </span>{" "}
              than the BFS plan — that difference is what the heuristic buys you.
            </>
          ) : (
            "One of the searches stopped before reaching the goal with the current limits — open Advanced settings to raise them."
          )}
        </p>

        {/* 3. Graph */}
        <section className="surface mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">
              Search graph — {result.algorithmName}
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={algorithm === "bfs" ? "default" : "outline"}
                onClick={() => setAlgorithm("bfs")}
              >
                BFS
              </Button>
              <Button
                size="sm"
                variant={algorithm === "astar" ? "default" : "outline"}
                onClick={() => setAlgorithm("astar")}
              >
                A*
              </Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Each box is a verification state; each arrow is one check with an effort cost.
            Highlighted arrows are the plan this algorithm chose. Click a box to inspect it.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-primary bg-primary/15" />
              on chosen path
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-border bg-muted" />
              already explored
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-border bg-caution-soft" />
              waiting in frontier
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
              {animating ? "Pause" : "Animate the plan"}
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
            <Button size="sm" variant="ghost" onClick={() => setShowLayout((v) => !v)}>
              <ChevronDown
                className={`size-4 transition-transform ${showLayout ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              Layout options
            </Button>
          </div>

          {showLayout && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-border bg-muted/50 p-3">
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
              {collapsed.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setCollapsed([])}>
                  Expand all ({collapsed.length})
                </Button>
              )}
            </div>
          )}

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
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  {[
                    ["Promise (0–100)", inspectedH.promise],
                    ["h(n) — estimated effort left", inspectedH.hCost],
                    ["Steps to goal", inspectedH.stepsToGoal],
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

              {advanced && inspectedH && (
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
                  {[
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

        {/* 4. Chosen plan */}
        <section className="surface mt-6 p-5">
          <h2 className="font-display text-lg font-bold">
            The plan {result.algorithmName} recommends
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read top to bottom: this is the order of verification work for this claim.
          </p>
          <ol className="mt-4 space-y-2">
            {result.path.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No complete plan — the search halted before the goal state.
              </li>
            )}
            {result.path.map((id, i) => {
              const edge = i > 0 ? edgeBetween(graph, result.path[i - 1]!, id) : undefined;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedState(id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:border-primary ${
                      animIndex === i ? "border-caution bg-caution-soft" : "border-border"
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {edge ? edge.action : "Start with the claim as received"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        → {stateLabel(graph, id)}
                        {edge ? ` · effort ${edge.cost}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 5. Advanced */}
        <section className="surface mt-6 p-5">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={advanced}
          >
            <span>
              <span className="block font-display text-lg font-bold">Advanced settings</span>
              <span className="block text-sm text-muted-foreground">
                Search limits, heuristic weights, the full step-by-step trace and all four
                algorithms.
              </span>
            </span>
            <ChevronDown
              className={`size-5 shrink-0 transition-transform ${advanced ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {advanced && (
            <div className="mt-6 space-y-8">
              {/* Algorithm picker */}
              <div>
                <p className="eyebrow">Algorithm shown in the graph and plan</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ALGORITHMS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAlgorithm(a.id)}
                      aria-pressed={a.id === algorithm}
                      className={`rounded-lg border p-3 text-left transition ${
                        a.id === algorithm
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-display text-sm font-bold">{a.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.type}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Limits + weights */}
              <div>
                <p className="eyebrow">Search limits</p>
                <div className="mt-3 grid gap-5 md:grid-cols-3">
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
                        <span className="font-display text-sm font-bold">
                          {draftOptions[c.key]}
                        </span>
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

                <p className="eyebrow mt-6">Heuristic weights</p>
                <div className="mt-3 grid gap-5 md:grid-cols-3">
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
                {result.limitHit && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Limit applied: {result.limitHit}
                  </p>
                )}
              </div>

              {/* Step trace */}
              {step && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="eyebrow">
                      Trace — step {step.index + 1} of {result.steps.length}
                    </p>
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
                        onClick={() =>
                          setStepIndex((i) => Math.min(result.steps.length - 1, i + 1))
                        }
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
                                {c.pruned
                                  ? `pruned — ${c.pruned}`
                                  : c.selected
                                    ? "selected"
                                    : "queued"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* All four algorithms */}
              <div>
                <p className="eyebrow">All four algorithms on this claim</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2">Algorithm</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Explored</th>
                        <th className="py-2">Path</th>
                        <th className="py-2">Cost</th>
                        <th className="py-2">Peak frontier</th>
                        <th className="py-2">Runtime</th>
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
                          <td className="py-2 text-xs text-muted-foreground">{r.searchType}</td>
                          <td className="py-2">{r.nodesExplored}</td>
                          <td className="py-2">{r.pathLength}</td>
                          <td className="py-2">{r.searchCost}</td>
                          <td className="py-2">{r.peakFrontier}</td>
                          <td className="py-2">{r.runtimeMs.toFixed(2)} ms</td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {r.goalReached ? "reached" : "halted"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* State reference */}
              <div>
                <p className="eyebrow">State space reference</p>
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
              </div>
            </div>
          )}
        </section>

        <p className="mt-8 rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
          These searches order verification work; they never decide whether a claim is true. Always
          read the primary publication on the official portal before drawing a conclusion.
        </p>
      </div>
    </AppShell>
  );
}
