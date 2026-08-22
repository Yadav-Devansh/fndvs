import type { AiGraph, Candidate, SearchResult, SearchStep } from "./types";
import { finish, label, pathCost } from "./common";

/** Hill Climbing — move only to a neighbour that improves the heuristic. */
export function hillClimbing(graph: AiGraph): SearchResult {
  let current = graph.start;
  const path: string[] = [current];
  const explored: string[] = [current];
  const steps: SearchStep[] = [];
  let goalReached = current === graph.goal;
  let stoppedNote = "";

  while (!goalReached) {
    const neighbours = graph.edges[current] ?? [];
    const currentPromise = graph.heuristics[current]?.promise ?? 0;

    const candidates: Candidate[] = neighbours.map((e) => ({
      id: e.to,
      label: label(graph, e.to),
      g: e.cost,
      h: graph.heuristics[e.to]?.promise ?? 0,
      f: graph.heuristics[e.to]?.promise ?? 0,
      promise: graph.heuristics[e.to]?.promise ?? 0,
      selected: false,
    }));

    const best = [...candidates].sort((a, b) => b.promise - a.promise)[0];

    if (!best || best.promise <= currentPromise) {
      stoppedNote = "Hill Climbing stopped at a local maximum.";
      steps.push({
        index: steps.length,
        current,
        frontier: candidates.map((c) => c.id),
        explored: [...explored],
        candidates,
        note: `No neighbour improves on ${label(graph, current)} (h = ${currentPromise}). ${stoppedNote}`,
        depth: path.length - 1,
      });
      break;
    }

    for (const c of candidates) c.selected = c.id === best.id;
    steps.push({
      index: steps.length,
      current,
      frontier: candidates.map((c) => c.id),
      explored: [...explored],
      candidates,
      selected: best.id,
      note: `Current h = ${currentPromise}. Best neighbour ${label(graph, best.id)} improves it to ${best.promise}, so the search climbs there.`,
      depth: path.length - 1,
    });

    current = best.id;
    path.push(current);
    explored.push(current);
    goalReached = current === graph.goal;
  }

  if (goalReached) {
    steps.push({
      index: steps.length,
      current,
      frontier: [],
      explored: [...explored],
      candidates: [],
      note: `Goal state ${label(graph, current)} reached — verification path complete.`,
      depth: path.length - 1,
    });
  }

  return finish(
    {
      algorithm: "hill-climbing",
      algorithmName: "Hill Climbing",
      searchType: "Local (informed)",
      path: goalReached ? path : path,
      nodesExplored: explored.length,
      maxDepth: path.length - 1,
      goalReached,
      steps,
      searchCost: pathCost(graph, path),
      note:
        (stoppedNote ? stoppedNote + " " : "") +
        "Hill Climbing only accepts a strictly better neighbour, so it is fast and memory-light but can halt before the goal when every next check looks worse.",
    },
    graph,
  );
}
