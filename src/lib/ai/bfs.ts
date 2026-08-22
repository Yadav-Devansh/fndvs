import type { AiGraph, Candidate, SearchResult, SearchStep } from "./types";
import { finish, label, reconstruct } from "./common";

/** Uninformed search: explores every state at the current depth first. */
export function bfs(graph: AiGraph): SearchResult {
  const parent: Record<string, string | undefined> = { [graph.start]: undefined };
  const depth: Record<string, number> = { [graph.start]: 0 };
  const visited = new Set<string>([graph.start]);
  const queue: string[] = [graph.start];
  const explored: string[] = [];
  const steps: SearchStep[] = [];
  let goalReached = false;

  while (queue.length) {
    const current = queue.shift()!;
    explored.push(current);
    const candidates: Candidate[] = [];

    if (current === graph.goal) {
      steps.push({
        index: steps.length,
        current,
        frontier: [...queue],
        explored: [...explored],
        candidates,
        note: `Goal state ${label(graph, current)} dequeued at depth ${depth[current]}. Search stops.`,
        depth: depth[current] ?? 0,
      });
      goalReached = true;
      break;
    }

    for (const edge of graph.edges[current] ?? []) {
      const isNew = !visited.has(edge.to);
      candidates.push({
        id: edge.to,
        label: label(graph, edge.to),
        g: 0,
        h: 0,
        f: 0,
        promise: graph.heuristics[edge.to]?.promise ?? 0,
        selected: isNew,
      });
      if (isNew) {
        visited.add(edge.to);
        parent[edge.to] = current;
        depth[edge.to] = (depth[current] ?? 0) + 1;
        queue.push(edge.to);
      }
    }

    steps.push({
      index: steps.length,
      current,
      frontier: [...queue],
      explored: [...explored],
      candidates,
      note: `Expanded ${label(graph, current)} at depth ${depth[current]}; enqueued ${
        candidates.filter((c) => c.selected).length
      } new state(s) — FIFO order, no heuristic used.`,
      depth: depth[current] ?? 0,
    });
  }

  const path = goalReached ? reconstruct(parent, graph.goal) : [];
  return finish(
    {
      algorithm: "bfs",
      algorithmName: "Breadth First Search",
      searchType: "Uninformed",
      path,
      nodesExplored: explored.length,
      maxDepth: Math.max(...explored.map((id) => depth[id] ?? 0)),
      goalReached,
      steps,
      note: "BFS explores all available states at the current depth before moving to deeper states. It guarantees the fewest actions, but ignores verification cost and usefulness.",
    },
    graph,
  );
}
