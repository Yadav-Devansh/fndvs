import type { AiGraph, Candidate, SearchOptions, SearchResult, SearchStep } from "./types";
import { finish, label, now, reconstruct, resolveOptions } from "./common";

/** Greedy Best First Search — always expands the most promising state h(n). */
export function bestFirst(graph: AiGraph, options?: Partial<SearchOptions>): SearchResult {
  const opts = resolveOptions(options);
  const startedAt = now();
  const parent: Record<string, string | undefined> = { [graph.start]: undefined };
  const depth: Record<string, number> = { [graph.start]: 0 };
  const visited = new Set<string>([graph.start]);
  const frontier: string[] = [graph.start];
  const explored: string[] = [];
  const steps: SearchStep[] = [];
  let goalReached = false;
  let expansions = 0;
  let peakFrontier = 1;
  let limitHit: string | undefined;

  const promise = (id: string) => graph.heuristics[id]?.promise ?? 0;

  while (frontier.length) {
    if (expansions >= opts.maxIterations) {
      limitHit = `Iteration limit (${opts.maxIterations} expansions) reached.`;
      break;
    }
    frontier.sort((a, b) => promise(b) - promise(a));
    const current = frontier.shift()!;
    explored.push(current);
    expansions++;

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
      const nextDepth = (depth[current] ?? 0) + 1;
      const candidate: Candidate = {
        id: edge.to,
        label: label(graph, edge.to),
        g: edge.cost,
        h: promise(edge.to),
        f: promise(edge.to),
        promise: promise(edge.to),
        selected: false,
      };
      candidates.push(candidate);
      if (nextDepth > opts.maxDepth) {
        candidate.pruned = `depth ${nextDepth} > max depth ${opts.maxDepth}`;
        limitHit ??= `Depth limit (${opts.maxDepth}) pruned deeper states.`;
        continue;
      }
      visited.add(edge.to);
      parent[edge.to] = current;
      depth[edge.to] = nextDepth;
      frontier.push(edge.to);
    }

    if (frontier.length > opts.maxFrontier) {
      frontier.sort((a, b) => promise(b) - promise(a));
      const dropped = frontier.splice(opts.maxFrontier);
      for (const id of dropped) visited.delete(id);
      for (const c of candidates) {
        if (dropped.includes(c.id)) c.pruned = `frontier beam ${opts.maxFrontier}`;
      }
      limitHit ??= `Frontier beam (${opts.maxFrontier}) dropped low-promise states.`;
    }
    peakFrontier = Math.max(peakFrontier, frontier.length);

    const best = [...frontier].sort((a, b) => promise(b) - promise(a))[0];
    for (const c of candidates) c.selected = c.id === best;

    steps.push({
      index: steps.length,
      current,
      frontier: [...frontier],
      explored: [...explored],
      candidates,
      ...(best ? { selected: best } : {}),
      note: best
        ? `Next state ${label(graph, best)} selected because it has the highest heuristic priority (${promise(best)}).`
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
      expansions,
      peakFrontier,
      ...(limitHit ? { limitHit } : {}),
      maxDepth: Math.max(0, ...explored.map((id) => depth[id] ?? 0)),
      goalReached,
      steps,
      note: "Best First Search always expands the state with the best heuristic score. It reaches useful checks quickly, but ignores the cost already spent, so the path is not guaranteed to be cheapest.",
    },
    graph,
    startedAt,
  );
}
