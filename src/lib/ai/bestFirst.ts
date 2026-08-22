import type { AiGraph, Candidate, SearchResult, SearchStep } from "./types";
import { finish, label, reconstruct } from "./common";

/** Greedy Best First Search — always expands the most promising state h(n). */
export function bestFirst(graph: AiGraph): SearchResult {
  const parent: Record<string, string | undefined> = { [graph.start]: undefined };
  const depth: Record<string, number> = { [graph.start]: 0 };
  const visited = new Set<string>([graph.start]);
  let frontier: string[] = [graph.start];
  const explored: string[] = [];
  const steps: SearchStep[] = [];
  let goalReached = false;

  while (frontier.length) {
    frontier.sort((a, b) => (graph.heuristics[b]?.promise ?? 0) - (graph.heuristics[a]?.promise ?? 0));
    const current = frontier.shift()!;
    explored.push(current);

    if (current === graph.goal) {
      steps.push({
        index: steps.length,
        current,
        frontier: [...frontier],
        explored: [...explored],
        candidates: [],
        note: `Goal state ${label(graph, current)} selected — search complete.`,
        depth: depth[current] ?? 0,
      });
      goalReached = true;
      break;
    }

    const candidates: Candidate[] = [];
    for (const edge of graph.edges[current] ?? []) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      parent[edge.to] = current;
      depth[edge.to] = (depth[current] ?? 0) + 1;
      frontier.push(edge.to);
      candidates.push({
        id: edge.to,
        label: label(graph, edge.to),
        g: 0,
        h: graph.heuristics[edge.to]?.promise ?? 0,
        f: graph.heuristics[edge.to]?.promise ?? 0,
        promise: graph.heuristics[edge.to]?.promise ?? 0,
        selected: false,
      });
    }

    const best = [...frontier].sort(
      (a, b) => (graph.heuristics[b]?.promise ?? 0) - (graph.heuristics[a]?.promise ?? 0),
    )[0];
    for (const c of candidates) c.selected = c.id === best;

    steps.push({
      index: steps.length,
      current,
      frontier: [...frontier],
      explored: [...explored],
      candidates,
      ...(best ? { selected: best } : {}),
      note: best
        ? `Next state ${label(graph, best)} selected because it has the highest heuristic priority (${graph.heuristics[best]?.promise}).`
        : "No candidates remain.",
      depth: depth[current] ?? 0,
    });
  }

  const path = goalReached ? reconstruct(parent, graph.goal) : [];
  return finish(
    {
      algorithm: "best-first",
      algorithmName: "Best First Search",
      searchType: "Informed (greedy)",
      path,
      nodesExplored: explored.length,
      maxDepth: Math.max(...explored.map((id) => depth[id] ?? 0)),
      goalReached,
      steps,
      note: "Best First Search always expands the state with the best heuristic score. It reaches useful checks quickly, but ignores the cost already spent, so the path is not guaranteed to be cheapest.",
    },
    graph,
  );
}
