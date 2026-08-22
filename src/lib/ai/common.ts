import type { AiGraph, SearchResult } from "./types";
import { round1 } from "./stateSpace";

export function reconstruct(parent: Record<string, string | undefined>, goal: string): string[] {
  const path: string[] = [];
  let cur: string | undefined = goal;
  while (cur) {
    path.unshift(cur);
    cur = parent[cur];
  }
  return path;
}

export function pathCost(graph: AiGraph, path: string[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = (graph.edges[path[i]!] ?? []).find((e) => e.to === path[i + 1]);
    total += edge?.cost ?? 0;
  }
  return round1(total);
}

export function label(graph: AiGraph, id: string) {
  const s = graph.byId[id];
  return s ? `${s.code} · ${s.label}` : id;
}

export function finish(
  partial: Omit<SearchResult, "pathLength" | "searchCost"> & { searchCost?: number },
  graph: AiGraph,
): SearchResult {
  return {
    ...partial,
    pathLength: Math.max(0, partial.path.length - 1),
    searchCost: partial.searchCost ?? pathCost(graph, partial.path),
  };
}
