import type { AiGraph, SearchOptions, SearchResult } from "./types";
import { round1 } from "./stateSpace";

export const DEFAULT_OPTIONS: SearchOptions = {
  maxDepth: 12,
  maxIterations: 200,
  maxFrontier: 50,
};

export function resolveOptions(options?: Partial<SearchOptions>): SearchOptions {
  return { ...DEFAULT_OPTIONS, ...(options ?? {}) };
}

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

export function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

type FinishInput = Omit<
  SearchResult,
  "pathLength" | "searchCost" | "runtimeMs" | "peakFrontier"
> & {
  searchCost?: number;
  peakFrontier?: number;
};

export function finish(partial: FinishInput, graph: AiGraph, startedAt = now()): SearchResult {
  return {
    ...partial,
    peakFrontier: partial.peakFrontier ?? 0,
    runtimeMs: Math.round((now() - startedAt) * 1000) / 1000,
    pathLength: Math.max(0, partial.path.length - 1),
    searchCost: partial.searchCost ?? pathCost(graph, partial.path),
  };
}
