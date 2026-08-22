import type { AiGraph, Candidate, SearchOptions, SearchResult, SearchStep } from "./types";
import { finish, label, now, reconstruct, resolveOptions } from "./common";
import { round1 } from "./stateSpace";

/** A* — expands the node with the lowest f(n) = g(n) + h(n). */
export function aStar(graph: AiGraph, options?: Partial<SearchOptions>): SearchResult {
  const opts = resolveOptions(options);
  const startedAt = now();
  const g: Record<string, number> = { [graph.start]: 0 };
  const parent: Record<string, string | undefined> = { [graph.start]: undefined };
  const depth: Record<string, number> = { [graph.start]: 0 };
  const open = new Set<string>([graph.start]);
  const explored: string[] = [];
  const steps: SearchStep[] = [];
  let goalReached = false;
  let expansions = 0;
  let peakFrontier = 1;
  let limitHit: string | undefined;

  const h = (id: string) => graph.heuristics[id]?.hCost ?? 0;
  const f = (id: string) => round1((g[id] ?? Infinity) + h(id));

  while (open.size) {
    if (expansions >= opts.maxIterations) {
      limitHit = `Iteration limit (${opts.maxIterations} expansions) reached.`;
      break;
    }
    const current = [...open].sort((a, b) => f(a) - f(b) || h(a) - h(b))[0]!;
    open.delete(current);
    explored.push(current);
    expansions++;

    if (current === graph.goal) {
      steps.push({
        index: steps.length,
        current,
        frontier: [...open],
        explored: [...explored],
        candidates: [],
        note: `Goal state ${label(graph, current)} has the lowest f(n) = ${f(current)} — optimal verification path found.`,
        depth: depth[current] ?? 0,
      });
      goalReached = true;
      break;
    }

    const candidates: Candidate[] = [];
    for (const edge of graph.edges[current] ?? []) {
      const tentative = round1((g[current] ?? 0) + edge.cost);
      const known = g[edge.to];
      const nextDepth = (depth[current] ?? 0) + 1;
      let pruned: string | undefined;
      if (nextDepth > opts.maxDepth) {
        pruned = `depth ${nextDepth} > max depth ${opts.maxDepth}`;
        limitHit ??= `Depth limit (${opts.maxDepth}) pruned deeper states.`;
      } else if (known === undefined || tentative < known) {
        g[edge.to] = tentative;
        parent[edge.to] = current;
        depth[edge.to] = nextDepth;
        open.add(edge.to);
      }
      candidates.push({
        id: edge.to,
        label: label(graph, edge.to),
        g: g[edge.to] ?? tentative,
        h: h(edge.to),
        f: f(edge.to),
        promise: graph.heuristics[edge.to]?.promise ?? 0,
        selected: false,
        ...(pruned ? { pruned } : {}),
      });
    }

    if (open.size > opts.maxFrontier) {
      const ordered = [...open].sort((a, b) => f(a) - f(b) || h(a) - h(b));
      for (const id of ordered.slice(opts.maxFrontier)) {
        open.delete(id);
        const c = candidates.find((x) => x.id === id);
        if (c) c.pruned = `frontier beam ${opts.maxFrontier}`;
      }
      limitHit ??= `Frontier beam (${opts.maxFrontier}) dropped high-f states.`;
    }
    peakFrontier = Math.max(peakFrontier, open.size);

    const next = [...open].sort((a, b) => f(a) - f(b) || h(a) - h(b))[0];
    for (const c of candidates) c.selected = c.id === next;

    steps.push({
      index: steps.length,
      current,
      frontier: [...open],
      explored: [...explored],
      candidates,
      ...(next ? { selected: next } : {}),
      note: next
        ? `Expanded ${label(graph, current)} (g = ${g[current]}, h = ${h(current)}, f = ${f(current)}). Lowest f(n) in the open list is now ${label(graph, next)} with f = ${f(next)}.`
        : `Expanded ${label(graph, current)}; open list empty.`,
      depth: depth[current] ?? 0,
    });
  }

  const path = goalReached ? reconstruct(parent, graph.goal) : [];
  return finish(
    {
      algorithm: "astar",
      algorithmName: "A* Search",
      searchType: "Informed (optimal)",
      path,
      nodesExplored: explored.length,
      expansions,
      peakFrontier,
      ...(limitHit ? { limitHit } : {}),
      maxDepth: Math.max(0, ...explored.map((id) => depth[id] ?? 0)),
      goalReached,
      steps,
      note: "A* combines the cost already spent, g(n), with the estimated remaining verification cost, h(n). It expands the state with the lowest f(n) = g(n) + h(n), giving the cheapest complete verification path.",
    },
    graph,
    startedAt,
  );
}
