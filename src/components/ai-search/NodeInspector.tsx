import { evidence, isGoal, setLabel, type PlanResult, type Problem } from "@/lib/planner";

export function NodeInspector({ problem, result, id }: { problem: Problem; result: PlanResult; id: number | null }) {
  if (id === null) {
    return <div className="surface p-4 text-sm text-muted-foreground">Click a node in the tree to inspect its check set, g, h and f.</div>;
  }
  const n = result.tree[id]!;
  const parent = n.parent === null ? null : result.tree[n.parent]!;
  const children = result.tree.filter((c) => c.parent === id);
  const f = n.g + n.h;
  return (
    <div className="surface space-y-2 p-4 text-sm">
      <h2 className="eyebrow">Node #{n.id}</h2>
      <p className="font-semibold">{setLabel(problem, n.mask)}</p>
      <p>
        Status: <strong>{n.status}</strong> · depth {n.depth} · {isGoal(problem, n.mask) ? "goal state" : "not a goal"}
      </p>
      <p>
        Move: {n.check === null ? "start (no checks yet)" : `run “${problem.checks[n.check]!.label}” (cost ${problem.checks[n.check]!.cost})`}
      </p>
      <p className="font-mono text-xs">
        g = {n.g.toFixed(2)} · h = {Number.isFinite(n.h) ? n.h.toFixed(2) : "∞"} · f = {Number.isFinite(f) ? f.toFixed(2) : "∞"} · E(S) ={" "}
        {evidence(problem, n.mask).toFixed(2)} / T = {problem.threshold.toFixed(2)}
      </p>
      <p>Parent: {parent ? `#${parent.id} ${setLabel(problem, parent.mask)}` : "none"}</p>
      <p>Children generated: {children.length}</p>
    </div>
  );
}
