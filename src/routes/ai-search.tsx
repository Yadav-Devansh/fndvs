import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ClaimInput, SAMPLE_CLAIMS } from "@/components/ai-search/ClaimInput";
import { ResultStrip } from "@/components/ai-search/ResultStrip";
import { PlanList } from "@/components/ai-search/PlanList";
import { SearchTree } from "@/components/ai-search/SearchTree";
import { NodeInspector } from "@/components/ai-search/NodeInspector";
import { AdvancedPanel } from "@/components/ai-search/AdvancedPanel";
import { HowItWorks } from "@/components/ai-search/HowItWorks";
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
          "BFS, Uniform-Cost and A* search over 2048 sets of verification checks to find the cheapest plan that gathers enough evidence for a claim.",
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
  const [text, setText] = useState(SAMPLE_CLAIMS[0]!.text);
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
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <PageHeader
          eyebrow="AI search lab"
          title="Plan the cheapest checks"
          description="Verification checks cost time and API credits. For this claim, search finds the cheapest set and order of checks that gathers enough evidence — then stops."
        />

        <ClaimInput text={text} onChange={(t) => { setText(t); setSelected(null); }} records={records} />

        {mounted && !data && <p className="text-sm text-muted-foreground">Enter at least 20 characters.</p>}

        {data && tree && (
          <>
            <ResultStrip results={[data.bfs, data.ucs, data.astar]} />
            <PlanList problem={data.problem} result={data.astar} />

            <div className="flex flex-wrap gap-2" role="group" aria-label="Tree to show">
              {TREE_ALGOS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={treeAlgo === a}
                  onClick={() => { setTreeAlgo(a); setSelected(null); }}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${treeAlgo === a ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {a === "bfs" ? "BFS tree" : a === "ucs" ? "UCS tree" : "A* tree"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <SearchTree problem={data.problem} result={tree} selected={selected} onSelect={setSelected} />
              <NodeInspector problem={data.problem} result={tree} id={selected} />
            </div>

            <HowItWorks />

            <AdvancedPanel
              problem={data.problem}
              tau={tau}
              onTau={setTau}
              costs={costs}
              onCost={(id, v) =>
                setCosts((c) => {
                  const next = { ...c };
                  if (v === null) delete next[id];
                  else next[id] = v;
                  return next;
                })
              }
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
