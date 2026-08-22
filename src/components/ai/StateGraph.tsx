import { useMemo } from "react";
import type { AiGraph } from "@/lib/ai";

interface Props {
  graph: AiGraph;
  path: string[];
  explored: string[];
  frontier: string[];
  currentId?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

const NODE_W = 118;
const NODE_H = 46;
const COL_GAP = 76;
const ROW_GAP = 16;

/** Unweighted layer (distance from the start state) used for the column layout. */
function layersOf(graph: AiGraph) {
  const layer: Record<string, number> = { [graph.start]: 0 };
  const queue = [graph.start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of graph.edges[cur] ?? []) {
      if (layer[e.to] === undefined) {
        layer[e.to] = (layer[cur] ?? 0) + 1;
        queue.push(e.to);
      }
    }
  }
  return layer;
}

export function StateGraph({
  graph,
  path,
  explored,
  frontier,
  currentId,
  selectedId,
  onSelect,
}: Props) {
  const { positions, width, height } = useMemo(() => {
    const layer = layersOf(graph);
    const columns = new Map<number, string[]>();
    for (const s of graph.states) {
      const l = layer[s.id] ?? 0;
      columns.set(l, [...(columns.get(l) ?? []), s.id]);
    }
    const maxLayer = Math.max(...columns.keys());
    const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
    const h = maxRows * (NODE_H + ROW_GAP) + ROW_GAP;
    const pos: Record<string, { x: number; y: number }> = {};
    for (const [l, ids] of columns) {
      const colH = ids.length * (NODE_H + ROW_GAP) - ROW_GAP;
      ids.forEach((id, i) => {
        pos[id] = {
          x: l * (NODE_W + COL_GAP) + 12,
          y: (h - colH) / 2 + i * (NODE_H + ROW_GAP),
        };
      });
    }
    return {
      positions: pos,
      width: (maxLayer + 1) * (NODE_W + COL_GAP) + 24,
      height: h,
    };
  }, [graph]);

  const pathSet = new Set(path);
  const pathEdges = new Set(path.slice(0, -1).map((id, i) => `${id}->${path[i + 1]}`));
  const exploredSet = new Set(explored);
  const frontierSet = new Set(frontier);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Verification state space graph"
        className="min-w-full"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
          </marker>
        </defs>

        {/* edges */}
        {graph.states.flatMap((s) =>
          (graph.edges[s.id] ?? []).map((e) => {
            const a = positions[e.from];
            const b = positions[e.to];
            if (!a || !b) return null;
            const onPath = pathEdges.has(`${e.from}->${e.to}`);
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={onPath ? 2.4 : 1}
                markerEnd="url(#arrow)"
                className={
                  onPath ? "text-primary" : "text-muted-foreground/30"
                }
              />
            );
          }),
        )}

        {/* nodes */}
        {graph.states.map((s) => {
          const p = positions[s.id];
          if (!p) return null;
          const onPath = pathSet.has(s.id);
          const isCurrent = s.id === currentId;
          const isSelected = s.id === selectedId;
          const fill = onPath
            ? "fill-primary/15"
            : exploredSet.has(s.id)
              ? "fill-muted"
              : frontierSet.has(s.id)
                ? "fill-caution-soft"
                : "fill-card";
          const stroke = isSelected
            ? "text-ring"
            : isCurrent
              ? "text-caution"
              : onPath
                ? "text-primary"
                : "text-border";
          return (
            <g
              key={s.id}
              transform={`translate(${p.x},${p.y})`}
              onClick={() => onSelect(s.id)}
              tabIndex={0}
              role="button"
              aria-label={`${s.code} ${s.label}`}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") onSelect(s.id);
              }}
              className="cursor-pointer outline-none"
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                className={`${fill} ${stroke}`}
                stroke="currentColor"
                strokeWidth={isSelected || isCurrent ? 2.5 : 1.2}
              />
              <text
                x={8}
                y={18}
                className="fill-foreground text-[11px] font-semibold"
                style={{ fontSize: 11 }}
              >
                {s.code}
                {onPath ? ` · #${path.indexOf(s.id) + 1}` : ""}
              </text>
              <text
                x={8}
                y={33}
                className="fill-muted-foreground"
                style={{ fontSize: 9.5 }}
              >
                {s.label.length > 20 ? `${s.label.slice(0, 19)}…` : s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
