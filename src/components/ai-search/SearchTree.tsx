import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FullSearchTree } from "./FullSearchTree";
import { type PlanResult, type Problem, type TreeNode } from "@/lib/planner";

export function SearchTree({ problem, result, selected, onSelect }: {
  problem: Problem;
  result: PlanResult;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [view, setView] = useState("focused");
  const diagram = useMemo(() => {
    const path: TreeNode[] = [];
    let current = result.goalNode === null ? result.tree[0] : result.tree[result.goalNode];
    while (current) {
      path.unshift(current);
      current = current.parent === null ? undefined : result.tree[current.parent];
    }
    const pathIds = new Set(path.map((node) => node.id));
    const alternatives = path.flatMap((parent) => {
      const seen = new Set<number>();
      return result.tree.filter((node) => {
        if (node.parent !== parent.id || pathIds.has(node.id) || seen.has(node.mask)) return false;
        seen.add(node.mask);
        return true;
      }).sort((a, b) => (a.status === "pruned" ? 1 : 0) - (b.status === "pruned" ? 1 : 0) || a.g + a.h - b.g - b.h).slice(0, 2);
    });
    const nodes = [...path, ...alternatives];
    const positions = new Map<number, { x: number; y: number }>();
    path.forEach((node, index) => positions.set(node.id, { x: 300, y: 42 + index * 94 }));
    path.forEach((parent, index) => alternatives.filter((node) => node.parent === parent.id).forEach((node, side) => {
      positions.set(node.id, { x: side === 0 ? 98 : 502, y: 42 + (index + 1) * 94 });
    }));
    return { nodes, positions, pathIds, height: 94 * Math.max(2, ...nodes.map((node) => node.depth + 1)) };
  }, [result]);

  return (
    <section className="min-w-0 space-y-4" aria-label="Search graph">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{result.name} · decision tree</h2>
        <div className="flex gap-1" role="group" aria-label="Graph detail">
          <Button size="sm" variant={view === "focused" ? "secondary" : "ghost"} aria-pressed={view === "focused"} onClick={() => setView("focused")}>Focused</Button>
          <Button size="sm" variant={view === "full" ? "secondary" : "ghost"} aria-pressed={view === "full"} onClick={() => setView("full")}>Full exploration</Button>
        </div>
      </div>
      {view === "full" ? <FullSearchTree problem={problem} result={result} selected={selected} onSelect={onSelect} /> : <>
        <div className="overflow-x-auto rounded-md border border-border bg-muted/30">
          <svg viewBox={`0 0 600 ${diagram.height}`} className="block w-full min-w-[520px]" role="group" aria-label={`Focused search tree for ${result.name}`}>
            {diagram.nodes.map((node) => {
              if (node.parent === null) return null;
              const a = diagram.positions.get(node.parent);
              const b = diagram.positions.get(node.id);
              if (!a || !b) return null;
              return <path key={`edge-${node.id}`} d={`M ${a.x} ${a.y + 26} C ${a.x} ${a.y + 60}, ${b.x} ${b.y - 55}, ${b.x} ${b.y - 26}`} fill="none" className={diagram.pathIds.has(node.id) ? "stroke-chart-5" : "stroke-border"} strokeWidth={diagram.pathIds.has(node.id) ? 3 : 1.5} />;
            })}
            {diagram.nodes.map((node) => {
              const position = diagram.positions.get(node.id);
              if (!position) return null;
              const onPath = diagram.pathIds.has(node.id);
              const label = node.check === null ? "Start · no checks" : problem.checks[node.check]?.label ?? "Check";
              const words = label.split(" ");
              const split = words.length > 3;
              const first = split ? words.slice(0, Math.ceil(words.length / 2)).join(" ") : label;
              const second = split ? words.slice(Math.ceil(words.length / 2)).join(" ") : "";
              return <g key={node.id} transform={`translate(${position.x}, ${position.y})`} role="button" tabIndex={0} aria-label={`Inspect node ${node.id}: ${label}`} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(node.id); } }} className="cursor-pointer outline-none focus-visible:stroke-ring">
                <title>{`${label} · ${node.status} · g=${node.g.toFixed(2)} · h=${node.h.toFixed(2)}`}</title>
                <rect x="-90" y="-27" width="180" height="54" rx="6" className={`${onPath ? "fill-card stroke-chart-5" : "fill-background stroke-border"} ${selected === node.id ? "stroke-foreground" : ""}`} strokeWidth={onPath || selected === node.id ? 2 : 1} />
                <text textAnchor="middle" y={split ? -9 : -4} className="fill-foreground text-[12px] font-medium">{first}</text>
                {second && <text textAnchor="middle" y="5" className="fill-foreground text-[12px] font-medium">{second}</text>}
                <text textAnchor="middle" y="20" className="fill-muted-foreground text-[10px]">{onPath ? `g ${node.g.toFixed(1)} · h ${node.h.toFixed(1)}` : node.status === "pruned" ? "Pruned alternative" : "Alternative"}</text>
              </g>;
            })}
          </svg>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-chart-5" />{result.goalReached ? "Chosen path" : "Starting state"} <span className="ml-3 h-0.5 w-5 bg-border" />Alternatives</span>
          <span>{diagram.nodes.length} shown / {result.generated} generated</span>
        </div>
      </>}
    </section>
  );
}