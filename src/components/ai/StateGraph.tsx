import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import type { AiGraph } from "@/lib/ai";
import { Button } from "@/components/ui/button";

export interface GraphFilters {
  showExplored: boolean;
  showFrontier: boolean;
  showUnvisited: boolean;
}

interface Props {
  graph: AiGraph;
  path: string[];
  explored: string[];
  frontier: string[];
  currentId?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  filters: GraphFilters;
  collapsed: string[];
  onToggleCollapse: (id: string) => void;
  /** Index into `path` currently highlighted by the walk-through animation, or -1. */
  animateIndex?: number;
}

const NODE_W = 118;
const NODE_H = 46;
const COL_GAP = 76;
const ROW_GAP = 16;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
  filters,
  collapsed,
  onToggleCollapse,
  animateIndex = -1,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const pathSet = useMemo(() => new Set(path), [path]);
  const exploredSet = useMemo(() => new Set(explored), [explored]);
  const frontierSet = useMemo(() => new Set(frontier), [frontier]);
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);

  const visible = useMemo(() => {
    // Reachability from the start, stopping at collapsed branches.
    const reach = new Set<string>([graph.start]);
    const queue = [graph.start];
    while (queue.length) {
      const cur = queue.shift()!;
      if (collapsedSet.has(cur)) continue;
      for (const e of graph.edges[cur] ?? []) {
        if (!reach.has(e.to)) {
          reach.add(e.to);
          queue.push(e.to);
        }
      }
    }
    const keep = new Set<string>();
    for (const id of reach) {
      if (id === graph.start || pathSet.has(id)) {
        keep.add(id);
        continue;
      }
      const isExplored = exploredSet.has(id);
      const isFrontier = frontierSet.has(id);
      if (isExplored && !filters.showExplored) continue;
      if (!isExplored && isFrontier && !filters.showFrontier) continue;
      if (!isExplored && !isFrontier && !filters.showUnvisited) continue;
      keep.add(id);
    }
    return keep;
  }, [graph, collapsedSet, pathSet, exploredSet, frontierSet, filters]);

  const { positions, width, height } = useMemo(() => {
    const layer = layersOf(graph);
    const columns = new Map<number, string[]>();
    for (const s of graph.states) {
      if (!visible.has(s.id)) continue;
      const l = layer[s.id] ?? 0;
      columns.set(l, [...(columns.get(l) ?? []), s.id]);
    }
    if (columns.size === 0) return { positions: {}, width: 200, height: 120 };
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
  }, [graph, visible]);

  const pathEdges = new Set(path.slice(0, -1).map((id, i) => `${id}->${path[i + 1]}`));
  const activeId = animateIndex >= 0 ? path[animateIndex] : undefined;
  const walkedEdges = new Set(
    animateIndex > 0
      ? path.slice(0, animateIndex).map((id, i) => `${id}->${path[i + 1]}`)
      : [],
  );

  // Wheel zoom anchored at the cursor (native listener so preventDefault works).
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, offset: o } = stateRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = clamp(z * Math.exp(-dy * 0.0015), MIN_ZOOM, MAX_ZOOM);
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / z;
      setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current;
    const { zoom: z, offset: o } = stateRef.current;
    const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
    const px = (el?.clientWidth ?? 0) / 2;
    const py = (el?.clientHeight ?? 0) / 2;
    const k = next / z;
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    setZoom(next);
  }, []);

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => zoomBy(1 / 1.25)}>
          <Minus className="size-4" aria-hidden="true" />
          <span className="sr-only">Zoom out</span>
        </Button>
        <span className="w-14 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => zoomBy(1.25)}>
          <Plus className="size-4" aria-hidden="true" />
          <span className="sr-only">Zoom in</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset}>
          <Maximize2 className="size-4" aria-hidden="true" /> Reset view
        </Button>
        <span className="text-xs text-muted-foreground">
          Scroll to zoom, drag to pan, double-click a state to collapse its branch.
        </span>
      </div>

      <div
        ref={containerRef}
        className={`relative h-[420px] overflow-hidden rounded-lg border border-border bg-card ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-node]")) return;
          dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          dragRef.current = null;
          setDragging(false);
        }}
      >
        <svg
          width="100%"
          height="100%"
          role="img"
          aria-label="Verification state space graph"
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

          <g transform={`translate(${offset.x},${offset.y}) scale(${zoom})`}>
            {/* edges */}
            {graph.states.flatMap((s) =>
              (graph.edges[s.id] ?? []).map((e) => {
                const a = positions[e.from];
                const b = positions[e.to];
                if (!a || !b) return null;
                const key = `${e.from}->${e.to}`;
                const onPath = pathEdges.has(key);
                const walked = walkedEdges.has(key);
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={key}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={onPath ? 2.4 : 1}
                    markerEnd="url(#arrow)"
                    className={
                      walked
                        ? "text-caution"
                        : onPath
                          ? "text-primary"
                          : "text-muted-foreground/30"
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
              const isActive = s.id === activeId;
              const hasChildren = (graph.edges[s.id] ?? []).length > 0;
              const isCollapsed = collapsedSet.has(s.id);
              const fill = onPath
                ? "fill-primary/15"
                : exploredSet.has(s.id)
                  ? "fill-muted"
                  : frontierSet.has(s.id)
                    ? "fill-caution-soft"
                    : "fill-card";
              const stroke = isActive
                ? "text-caution"
                : isSelected
                  ? "text-ring"
                  : isCurrent
                    ? "text-caution"
                    : onPath
                      ? "text-primary"
                      : "text-border";
              return (
                <g
                  key={s.id}
                  data-node
                  transform={`translate(${p.x},${p.y})`}
                  onClick={() => onSelect(s.id)}
                  onDoubleClick={() => hasChildren && onToggleCollapse(s.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${s.code} ${s.label}`}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") onSelect(s.id);
                  }}
                  className={`cursor-pointer outline-none ${isActive ? "animate-pulse" : ""}`}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    className={`${fill} ${stroke}`}
                    stroke="currentColor"
                    strokeWidth={isSelected || isCurrent || isActive ? 2.5 : 1.2}
                  />
                  <text
                    x={8}
                    y={18}
                    className="fill-foreground font-semibold"
                    style={{ fontSize: 11 }}
                  >
                    {s.code}
                    {onPath ? ` · #${path.indexOf(s.id) + 1}` : ""}
                  </text>
                  <text x={8} y={33} className="fill-muted-foreground" style={{ fontSize: 9.5 }}>
                    {s.label.length > 20 ? `${s.label.slice(0, 19)}…` : s.label}
                  </text>
                  {isCollapsed && (
                    <>
                      <circle cx={NODE_W - 10} cy={10} r={7} className="fill-caution" />
                      <text
                        x={NODE_W - 10}
                        y={13.5}
                        textAnchor="middle"
                        className="fill-caution-foreground font-bold"
                        style={{ fontSize: 9 }}
                      >
                        +
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
