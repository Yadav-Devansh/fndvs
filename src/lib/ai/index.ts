import type { AiGraph, AlgorithmId, SearchOptions, SearchResult } from "./types";
import { bfs } from "./bfs";
import { bestFirst } from "./bestFirst";
import { hillClimbing } from "./hillClimbing";
import { aStar } from "./aStar";

export * from "./types";
export { buildStateSpace, round1 } from "./stateSpace";
export { HEURISTIC_WEIGHTS, DEFAULT_HEURISTIC_WEIGHTS } from "./heuristic";
export { label as stateLabel, pathCost, DEFAULT_OPTIONS } from "./common";
export { bfs, bestFirst, hillClimbing, aStar };

export const ALGORITHMS: { id: AlgorithmId; name: string; type: string }[] = [
  { id: "bfs", name: "Breadth First Search", type: "Uninformed" },
  { id: "best-first", name: "Best First Search", type: "Informed (greedy)" },
  { id: "hill-climbing", name: "Hill Climbing", type: "Local (informed)" },
  { id: "astar", name: "A* Search", type: "Informed (optimal)" },
];

export function runAlgorithm(
  id: AlgorithmId,
  graph: AiGraph,
  options?: Partial<SearchOptions>,
): SearchResult {
  switch (id) {
    case "bfs":
      return bfs(graph, options);
    case "best-first":
      return bestFirst(graph, options);
    case "hill-climbing":
      return hillClimbing(graph, options);
    case "astar":
      return aStar(graph, options);
  }
}

export function runAll(graph: AiGraph, options?: Partial<SearchOptions>): SearchResult[] {
  return ALGORITHMS.map((a) => runAlgorithm(a.id, graph, options));
}
