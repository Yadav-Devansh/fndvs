import type { PlanResult, Problem } from "@/lib/planner";

export function SearchInference({ problem, result, results }: {
  problem: Problem;
  result: PlanResult;
  results: [PlanResult, PlanResult, PlanResult];
}) {
  const [bfs, ucs, astar] = results;
  const bothOptimalReached = ucs.goalReached && astar.goalReached;
  const sameCost = Math.abs(ucs.cost - astar.cost) < 0.000001;
  const expansionDifference = ucs.expanded - astar.expanded;
  const checks = result.plan.flatMap((index) => {
    const check = problem.checks[index];
    return check ? [check.label] : [];
  });

  return (
    <section className="space-y-6 border-t border-border pt-6" aria-label="Search inference">
      <div>
        <p className="eyebrow">Inference · {result.name}</p>
        <h2 className="mt-2 text-xl font-semibold">
          {result.goalReached ? "A check plan was found—not a truth verdict" : "No complete plan was found in this search"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {result.goalReached
            ? `${result.name} selected ${result.plan.length} checks with a total model cost of ${result.cost}. Their combined model gain is ${result.evidence.toFixed(2)}, meeting the target of ${problem.threshold.toFixed(2)}. The highlighted path shows how that set of checks was built.`
            : `${result.name}: ${result.note} A missing goal does not mean the claim is false; it means this run did not produce a complete check plan.`}
        </p>
        {checks.length > 0 && <p className="mt-3 break-words text-sm"><strong>Highlighted route:</strong> Start with no checks → {checks.join(" → ")}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-semibold">What the tree represents</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li><strong className="text-foreground">Root:</strong> no checks selected yet.</li>
            <li><strong className="text-foreground">Node:</strong> a set of selected checks, not an article, a source or a truth label.</li>
            <li><strong className="text-foreground">Branch:</strong> add one unused check. Different orders can lead to the same set, so duplicate routes are pruned.</li>
            <li><strong className="text-foreground">Highlighted path:</strong> the route to the selected goal. Other branches are alternatives considered, not contradictory evidence.</li>
            <li><strong className="text-foreground">Numbers:</strong> g is cost so far; h is a lower-bound estimate of remaining cost; A* prioritises f = g + h. These are planning values, not truth probabilities.</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">What this run demonstrates</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {bothOptimalReached
              ? sameCost
                ? `A* and UCS reached the target at the same model cost (${astar.cost}). ${expansionDifference > 0 ? `A* expanded ${expansionDifference} fewer nodes (${astar.expanded} versus ${ucs.expanded}), showing the benefit of heuristic guidance on this input.` : expansionDifference < 0 ? `A* expanded ${-expansionDifference} more nodes (${astar.expanded} versus ${ucs.expanded}); heuristic guidance did not reduce expansions on this input.` : `Both expanded ${astar.expanded} nodes; A* did not reduce expansions on this input.`}`
                : `A* and UCS returned different displayed costs (${astar.cost} and ${ucs.cost}). This run should not be presented as evidence that their costs match.`
              : "A* or UCS did not reach a goal, so this run cannot establish a successful same-cost comparison."}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {bfs.goalReached
              ? `BFS selected ${bfs.plan.length} checks at cost ${bfs.cost}. BFS minimises the number of checks, not their cost; equally cheap results can occur on some inputs.`
              : "BFS did not reach a goal in this run."}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Under this model, UCS and A* find a minimum-cost goal when the search completes: costs are positive, and A* uses an admissible, consistent fractional-knapsack heuristic. One graph illustrates a run; the guarantee comes from those algorithm assumptions, not the picture alone. A* is not guaranteed to have the shortest runtime on every claim.
          </p>
        </div>
      </div>

      <div className="border-l-2 border-primary pl-4">
        <h3 className="font-semibold">What it does not prove</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This lab plans checks; it does not execute external fact-check or news lookups. Local gains come from wording scores, external gains are estimates, and costs are model units—not measured API bills. Reaching the target does not prove a claim true or false, and does not mean independent evidence was collected. The claim report separately shows the wording/tone verdict and Gemini’s independent opinion; this tree changes neither.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="font-semibold">Presentation takeaway</h3>
        <p className="mt-2 text-sm leading-relaxed">
          “Our search problem is choosing checks efficiently, not deciding truth from a graph. Each node is a set of checks, each edge adds a check, and the goal is a model-gain target. BFS seeks the fewest checks; UCS seeks the lowest cost; A* adds a lower-bound heuristic to guide the search. The highlighted path is the proposed plan—not proof that the news is genuine.”
        </p>
      </div>
    </section>
  );
}