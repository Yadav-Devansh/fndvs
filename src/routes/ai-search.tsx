import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ClaimInput, SAMPLE_CLAIMS } from "@/components/ai-search/ClaimInput";
import { Button } from "@/components/ui/button";

import { SearchTree } from "@/components/ai-search/SearchTree";
import { NodeInspector } from "@/components/ai-search/NodeInspector";
import { AdvancedPanel } from "@/components/ai-search/AdvancedPanel";

import { SearchInference } from "@/components/ai-search/SearchInference";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyze } from "@/lib/detect";
import { DEFAULT_TAU, astar, bfs, greedy, hillClimb, problemFor, ucs, type AlgorithmId } from "@/lib/planner";
import { useRecords } from "./history";

export const Route = createFileRoute("/ai-search")({
  component: AiSearchPage,
  head: () => ({
    meta: [
      { title: "AI planner — cheapest verification checks | FNDVS" },
      {
        name: "description",
        content:
          "Compare BFS, UCS and A* with readable search trees and explanations of minimum-cost check planning.",
      },
      { property: "og:title", content: "AI planner — cheapest verification checks | FNDVS" },
      { property: "og:description", content: "A* finds the cheapest set and order of checks for any news claim." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TREE_ALGOS: AlgorithmId[] = ["bfs", "ucs", "astar"];

function AiSearchPage() {
  const records = useRecords();
  const [text, setText] = useState(SAMPLE_CLAIMS[0]?.text ?? "");
  const [tau, setTau] = useState(DEFAULT_TAU);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [treeAlgo, setTreeAlgo] = useState<AlgorithmId>("astar");
  const [selected, setSelected] = useState<number | null>(null);

  // Runtimes differ between server and browser, so search only runs after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ready = mounted && text.trim().length >= 20;
  const data = useMemo(() => {
    if (!ready) return null;
    const problem = problemFor(analyze(text), { tau, costs });
    return {
      problem,
      bfs: bfs(problem),
      ucs: ucs(problem),
      astar: astar(problem),
      greedy: greedy(problem),
      hill: hillClimb(problem),
    };
  }, [text, tau, costs, ready]);

  const tree = data ? (treeAlgo === "bfs" ? data.bfs : treeAlgo === "ucs" ? data.ucs : data.astar) : null;

  return (
    <AppShell>
      <div className="academic-blueprint mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
        <header className="text-center">
          <p className="eyebrow">FNDVS · AI Search lab</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Plan the cheapest checks</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">A search-algorithm demonstration. Compare routes to a model-gain target—not a truth verdict.</p>
        </header>

        <ClaimInput text={text} onChange={(t) => { setText(t); setSelected(null); }} records={records} />

        {mounted && !data && <p className="text-sm text-muted-foreground">Enter at least 20 characters.</p>}

        {data && tree && (
          <>
            <Tabs defaultValue="plan" className="space-y-5">
              <TabsList aria-label="Search results view" className="flex h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 pb-2">
                <TabsTrigger value="plan" className="px-3 py-2 sm:px-5">Execution plan</TabsTrigger>
                <TabsTrigger value="tree" className="px-3 py-2 sm:px-5">Search tree</TabsTrigger>
                <TabsTrigger value="inference" className="px-3 py-2 sm:px-5">Inference</TabsTrigger>
              </TabsList>
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border pb-5" aria-label="Algorithm comparison">
                {[data.bfs, data.ucs, data.astar].map((r) => (
                  <div key={r.algorithm} className={`px-3 sm:px-5 ${r.algorithm === "astar" ? "text-chart-5" : ""}`}>
                    <p className="text-sm font-semibold">{r.algorithm === "bfs" ? "BFS" : r.algorithm === "ucs" ? "UCS" : "A* Search"}</p>
                    <dl className="mt-3 space-y-1 text-xs sm:text-sm">
                      <div className="flex justify-between gap-1"><dt className="text-muted-foreground">Cost</dt><dd className="font-mono font-semibold">{r.goalReached ? r.cost : "—"}</dd></div>
                      <div className="flex justify-between gap-1"><dt className="text-muted-foreground">Checks</dt><dd className="font-mono">{r.plan.length}</dd></div>
                      <div className="flex justify-between gap-1"><dt className="text-muted-foreground">Expanded</dt><dd className="font-mono">{r.expanded}</dd></div>
                      <div className="flex justify-between gap-1"><dt className="text-muted-foreground">Time</dt><dd className="font-mono">{r.runtimeMs.toFixed(2)} ms</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1" role="group" aria-label="Algorithm to show">
                  {TREE_ALGOS.map((a) => <Button key={a} size="sm" variant={treeAlgo === a ? "secondary" : "ghost"} aria-pressed={treeAlgo === a} onClick={() => { setTreeAlgo(a); setSelected(null); }}>{a === "bfs" ? "BFS" : a === "ucs" ? "UCS" : "A*"}</Button>)}
                </div>
                <p className="text-xs text-muted-foreground">Target {data.problem.threshold.toFixed(2)} model gain · {Math.round(tau * 100)}% of available gain</p>
              </div>
              <TabsContent value="plan">
                <div className="grid gap-7 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold">Selected sequence</h2>
                    <ol className="space-y-3">
                      {tree.plan.map((index, step) => {
                        const check = data.problem.checks[index];
                        if (!check) return null;
                        return <li key={check.id} className="flex gap-3 border-b border-border pb-3"><span className="font-mono text-sm text-muted-foreground">{String(step + 1).padStart(2, "0")}</span><div><p className="text-sm font-semibold">{check.label}</p><p className="mt-1 text-xs text-muted-foreground">Cost {check.cost} · gain {check.gain.toFixed(2)}{check.estimated ? " (estimated)" : ""}</p></div></li>;
                      })}
                    </ol>
                    <p className="border-l-2 border-chart-5 pl-3 text-sm">{tree.goalReached ? `Total cost ${tree.cost} · model gain ${tree.evidence.toFixed(2)}` : tree.note}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">A proposed check plan only. External lookups are not executed in this lab.</p>
                  </div>
                  <div className="min-w-0 space-y-5 md:border-l md:border-border md:pl-6">
                    <SearchTree problem={data.problem} result={tree} selected={selected} onSelect={setSelected} />
                    {selected !== null && <NodeInspector problem={data.problem} result={tree} id={selected} />}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="tree" className="space-y-5">
                <SearchTree problem={data.problem} result={tree} selected={selected} onSelect={setSelected} />
                <NodeInspector problem={data.problem} result={tree} id={selected} />
              </TabsContent>
              <TabsContent value="inference">
                <SearchInference problem={data.problem} result={tree} results={[data.bfs, data.ucs, data.astar]} />
              </TabsContent>
            </Tabs>

            <AdvancedPanel
              problem={data.problem}
              tau={tau}
              onTau={(value) => { setTau(value); setSelected(null); }}
              costs={costs}
              onCost={(id, v) => {
                setSelected(null);
                setCosts((c) => {
                  const next = { ...c };
                  if (v === null) delete next[id];
                  else next[id] = v;
                  return next;
                });
              }}
              greedy={data.greedy}
              hill={data.hill}
              trace={tree}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
