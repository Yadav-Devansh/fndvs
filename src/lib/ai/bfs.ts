import type { AiGraph, Candidate, SearchOptions, SearchResult, SearchStep } from "./types";
import { finish, label, now, reconstruct, resolveOptions } from "./common";

/** Uninformed search: explores every state at the current depth first. */
export function bfs(graph: AiGraph, options?: Partial<SearchOptions>): SearchResult {
  const opts = resolveOptions(options);
  const startedAt = now();
  const parent: Record<string, string | undefined> = { [graph.start]: undefined };
  const depth: Record<string, number> = { [graph.start]: 0 };
  const visited = new Set<string>([graph.start]);
  const queue: string[] = [graph.start];
  const explored: string[] = [];
  const steps: SearchStep[] = [];
  let goalReached = false;
  let expansions = 0;
  let peakFrontier = 1;
  let limitHit: string | undefined;

  while (queue.length) {
    if (expansions >= opts.maxIterations) {
      limitHit = `Iteration limit (${opts.maxIterations} expansions) reached.`;
      break;
    }
    const current = queue.shift()!;
    explored.push(current);
    expansions++;
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
      const nextDepth = (depth[current] ?? 0) + 1;
      const isNew = !visited.has(edge.to);
      const tooDeep = nextDepth > opts.maxDepth;
      const candidate: Candidate = {
        id: edge.to,
        label: label(graph, edge.to),
        g: 0,
        h: 0,
        f: 0,
        promise: graph.heuristics[edge.to]?.promise ?? 0,
        selected: isNew && !tooDeep,
      };
      if (isNew && tooDeep) {
        candidate.pruned = `depth ${nextDepth} > max depth ${opts.maxDepth}`;
        limitHit ??= `Depth limit (${opts.maxDepth}) pruned deeper states.`;
      }
      candidates.push(candidate);
      if (isNew && !tooDeep) {
        visited.add(edge.to);
        parent[edge.to] = current;
        depth[edge.to] = nextDepth;
        queue.push(edge.to);
      }
    }

    if (queue.length > opts.maxFrontier) {
      const dropped = queue.splice(opts.maxFrontier);
      for (const id of dropped) visited.delete(id);
      for (const c of candidates) {
        if (dropped.includes(c.id)) {
          c.selected = false;
          c.pruned = `frontier limit ${opts.maxFrontier}`;
        }
      }
      limitHit ??= `Frontier limit (${opts.maxFrontier}) dropped queued states.`;
    }
    peakFrontier = Math.max(peakFrontier, queue.length);

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
      expansions,
      peakFrontier,
      ...(limitHit ? { limitHit } : {}),
      maxDepth: Math.max(0, ...explored.map((id) => depth[id] ?? 0)),
      goalReached,
      steps,
      note: "BFS explores all available states at the current depth before moving to deeper states. It guarantees the fewest actions, but ignores verification cost and usefulness.",
    },
    graph,
    startedAt,
  );
}
