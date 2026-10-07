import type { PlanResult } from "@/lib/planner";

/** One sentence computed from the real numbers. */
export function comparisonSentence(bfs: PlanResult, ucs: PlanResult, astar: PlanResult): string {
  const parts: string[] = [];
  const saved = ucs.expanded - astar.expanded;
  if (Math.abs(astar.cost - ucs.cost) < 1e-6) {
    parts.push(
      saved > 0
        ? `A* found the same-cost plan as UCS (cost ${astar.cost}) while expanding ${saved} fewer states (${astar.expanded} vs ${ucs.expanded}).`
        : `A* and UCS found the same-cost plan (cost ${astar.cost}) with the same number of expansions.`,
    );
  }
  if (bfs.cost > astar.cost + 1e-6) {
    parts.push(`BFS used fewer or equal checks (${bfs.plan.length}) but cost ${bfs.cost} — ${Math.round((bfs.cost - astar.cost) * 100) / 100} more, because it ignores cost.`);
  } else {
    parts.push(`BFS happened to find an equally cheap plan here (cost ${bfs.cost}).`);
  }
  return parts.join(" ");
}

export function ResultStrip({ results }: { results: [PlanResult, PlanResult, PlanResult] }) {
  const [bfs, ucs, astar] = results;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {results.map((r) => (
          <div key={r.algorithm} className="surface p-4">
            <p className="text-sm font-semibold">{r.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Checks chosen</dt>
              <dd className="text-right font-medium">{r.plan.length}</dd>
              <dt className="text-muted-foreground">Total cost</dt>
              <dd className="text-right font-medium">{r.cost}</dd>
              <dt className="text-muted-foreground">States expanded</dt>
              <dd className="text-right font-medium">{r.expanded}</dd>
              <dt className="text-muted-foreground">Runtime</dt>
              <dd className="text-right font-medium">{r.runtimeMs.toFixed(2)} ms</dd>
            </dl>
            {!r.goalReached && <p className="mt-2 text-xs font-medium text-destructive">{r.note}</p>}
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-border bg-muted p-3 text-sm">{comparisonSentence(bfs, ucs, astar)}</p>
    </div>
  );
}
