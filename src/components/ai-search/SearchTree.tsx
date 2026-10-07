import { useMemo } from "react";
import { setLabel, type PlanResult, type Problem, type TreeNode } from "@/lib/planner";

const MAX_SHOWN = 240;
const ROW = 70;
const COL = 26;

const STATUS_TEXT = { expanded: "Expanded", frontier: "Frontier", pruned: "Pruned" } as const;
const STATUS_CLASS = {
  expanded: "fill-primary",
  frontier: "fill-caution",
  pruned: "fill-muted-foreground/40",
} as const;

/** Nodes to draw: the plan path, every expanded node, then frontier/pruned children up to a cap. */
function pickNodes(result: PlanResult, onPath: Set<number>): TreeNode[] {
  const keep = new Set<number>(onPath);
  for (const n of result.tree) if (n.status === "expanded" && keep.size < MAX_SHOWN) keep.add(n.id);
  for (const n of result.tree) if (keep.size < MAX_SHOWN && n.parent !== null && keep.has(n.parent)) keep.add(n.id);
  // Make every kept node's ancestors visible.
  for (const id of [...keep]) {
    for (let p = result.tree[id]!.parent; p !== null && !keep.has(p); p = result.tree[p]!.parent) keep.add(p);
  }
  return result.tree.filter((n) => keep.has(n.id));
}

export function SearchTree({
  problem,
  result,
  selected,
  onSelect,
}: {
  problem: Problem;
  result: PlanResult;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const onPath = useMemo(() => {
    const s = new Set<number>();
    for (let id: number | null = result.goalNode; id !== null; id = result.tree[id]!.parent) s.add(id);
    return s;
  }, [result]);

  const nodes = useMemo(() => pickNodes(result, onPath), [result, onPath]);
  const layout = useMemo(() => {
    const byDepth = new Map<number, TreeNode[]>();
    for (const n of nodes) byDepth.set(n.depth, [...(byDepth.get(n.depth) ?? []), n]);
    const widest = Math.max(...[...byDepth.values()].map((r) => r.length));
    const width = Math.max(600, widest * COL + 40);
    const pos = new Map<number, { x: number; y: number }>();
    for (const [d, row] of byDepth) {
      const step = (width - 40) / Math.max(1, row.length);
      row.forEach((n, i) => pos.set(n.id, { x: 20 + step * (i + 0.5), y: 30 + d * ROW }));
    }
    return { pos, width, height: 60 + Math.max(...byDepth.keys()) * ROW };
  }, [nodes]);

  return (
    <div className="surface min-w-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">Search tree explored by {result.name}</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          {(["expanded", "frontier", "pruned"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="5" className={STATUS_CLASS[s]} /></svg>
              {STATUS_TEXT[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" className="fill-none stroke-real" strokeWidth="2" /></svg>
            Chosen plan
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Rows are depth (number of checks done). Showing {nodes.length} of {result.generated} generated nodes. Hover for g, h, f; click to inspect.
      </p>
      <div className="mt-3 overflow-auto rounded-md border border-border bg-background">
        <svg width={layout.width} height={layout.height} role="img" aria-label={`Search tree for ${result.name}`}>
          {nodes.map((n) => {
            if (n.parent === null) return null;
            const a = layout.pos.get(n.parent);
            const b = layout.pos.get(n.id);
            if (!a || !b) return null;
            const path = onPath.has(n.id) && onPath.has(n.parent);
            return <line key={`e${n.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={path ? "stroke-real" : "stroke-border"} strokeWidth={path ? 3 : 1} />;
          })}
          {nodes.map((n) => {
            const p = layout.pos.get(n.id)!;
            const f = n.g + n.h;
            return (
              <g key={n.id} onClick={() => onSelect(n.id)} className="cursor-pointer">
                <title>
                  {`${setLabel(problem, n.mask)}\n${STATUS_TEXT[n.status]}${onPath.has(n.id) ? " · on chosen plan" : ""}\ng=${n.g.toFixed(2)} h=${Number.isFinite(n.h) ? n.h.toFixed(2) : "∞"} f=${Number.isFinite(f) ? f.toFixed(2) : "∞"}`}
                </title>
                <circle cx={p.x} cy={p.y} r={onPath.has(n.id) ? 8 : 6} className={`${STATUS_CLASS[n.status]} ${onPath.has(n.id) ? "stroke-real" : ""} ${selected === n.id ? "stroke-foreground" : ""}`} strokeWidth={onPath.has(n.id) || selected === n.id ? 3 : 0} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
