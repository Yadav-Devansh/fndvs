import type { AiGraph, AlgorithmId, SearchResult } from "./types";
import { bfs } from "./bfs";
import { bestFirst } from "./bestFirst";
import { hillClimbing } from "./hillClimbing";
import { aStar } from "./aStar";

export * from "./types";
export { buildStateSpace, round1 } from "./stateSpace";
export { HEURISTIC_WEIGHTS } from "./heuristic";
export { label as stateLabel, pathCost } from "./common";
export { bfs, bestFirst, hillClimbing, aStar };

export const ALGORITHMS: { id: AlgorithmId; name: string; type: string }[] = [
  { id: "bfs", name: "Breadth First Search", type: "Uninformed" },
  { id: "best-first", name: "Best First Search", type: "Informed (greedy)" },
  { id: "hill-climbing", name: "Hill Climbing", type: "Local (informed)" },
  { id: "astar", name: "A* Search", type: "Informed (optimal)" },
];

export function runAlgorithm(id: AlgorithmId, graph: AiGraph): SearchResult {
  switch (id) {
    case "bfs":
      return bfs(graph);
    case "best-first":
      return bestFirst(graph);
    case "hill-climbing":
      return hillClimbing(graph);
    case "astar":
      return aStar(graph);
  }
}

export function runAll(graph: AiGraph): SearchResult[] {
  return ALGORITHMS.map((a) => runAlgorithm(a.id, graph));
}
