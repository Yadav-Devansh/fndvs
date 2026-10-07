/** BFS, Uniform-Cost, A*, Greedy best-first and Hill Climbing over check sets. */
import { heuristic, isGoal, evidence, type Problem } from "./problem";

export type AlgorithmId = "bfs" | "ucs" | "astar" | "greedy" | "hill";

export const ALGORITHM_NAMES: Record<AlgorithmId, string> = {
  bfs: "Breadth-First Search",
  ucs: "Uniform-Cost Search",
  astar: "A* Search",
  greedy: "Greedy Best-First",
  hill: "Hill Climbing",
};

export type NodeStatus = "expanded" | "frontier" | "pruned";

export interface TreeNode {
  id: number;
  parent: number | null;
  mask: number;
  /** Check index that produced this node (null for the root). */
  check: number | null;
  g: number;
  h: number;
  depth: number;
  status: NodeStatus;
}

export interface SearchStep {
  index: number;
  node: number;
  mask: number;
  g: number;
  h: number;
  note: string;
}

export interface PlanResult {
  algorithm: AlgorithmId;
  name: string;
  /** Check indices in the order they would run. */
  plan: number[];
  cost: number;
  evidence: number;
  goalReached: boolean;
  goalNode: number | null;
  expanded: number;
  generated: number;
  runtimeMs: number;
  tree: TreeNode[];
  steps: SearchStep[];
  note: string;
}

/** Binary min-heap with deterministic tie-breaking by insertion order. */
class Heap<T> {
  private a: { k: number; s: number; v: T }[] = [];
  private seq = 0;
  get size() {
    return this.a.length;
  }
  push(k: number, v: T) {
    const a = this.a;
    a.push({ k, s: this.seq++, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        [a[i], a[p]] = [a[p]!, a[i]!];
        i = p;
      } else break;
    }
  }
  pop(): T | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top.v;
  }
  private less(i: number, j: number) {
    const x = this.a[i]!;
    const y = this.a[j]!;
    return x.k < y.k - 1e-12 || (Math.abs(x.k - y.k) <= 1e-12 && x.s < y.s);
  }
}

function pathTo(tree: TreeNode[], id: number): number[] {
  const out: number[] = [];
  for (let n: TreeNode | undefined = tree[id]; n && n.check !== null; n = n.parent === null ? undefined : tree[n.parent]) {
    out.unshift(n.check);
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function finish(p: Problem, algorithm: AlgorithmId, tree: TreeNode[], steps: SearchStep[], goal: number | null, t0: number, note: string): PlanResult {
  const plan = goal === null ? [] : pathTo(tree, goal);
  const mask = plan.reduce((m, i) => m | (1 << i), 0);
  return {
    algorithm,
    name: ALGORITHM_NAMES[algorithm],
    plan,
    cost: r2(plan.reduce((s, i) => s + p.checks[i]!.cost, 0)),
    evidence: r2(evidence(p, mask)),
    goalReached: goal !== null,
    goalNode: goal,
    expanded: tree.filter((n) => n.status === "expanded").length,
    generated: tree.length,
    runtimeMs: Math.round((performance.now() - t0) * 1000) / 1000,
    tree,
    steps,
    note,
  };
}

/** Shared best-first loop. priority(g, h) decides UCS / A* / Greedy. */
function bestFirst(p: Problem, algorithm: "ucs" | "astar" | "greedy", priority: (g: number, h: number) => number, maxExpansions: number): PlanResult {
  const t0 = performance.now();
  const n = p.checks.length;
  const tree: TreeNode[] = [{ id: 0, parent: null, mask: 0, check: null, g: 0, h: heuristic(p, 0), depth: 0, status: "frontier" }];
  const steps: SearchStep[] = [];
  const bestG = new Map<number, number>([[0, 0]]);
  const closed = new Set<number>(); // keyed by bitmask
  const heap = new Heap<number>();
  heap.push(priority(0, tree[0]!.h), 0);

  while (heap.size) {
    const id = heap.pop()!;
    const node = tree[id]!;
    // Stale entry: a cheaper path to this set was found after it was queued.
    if (node.g > (bestG.get(node.mask) ?? Infinity) + 1e-12) {
      node.status = "pruned";
      continue;
    }
    if (closed.has(node.mask) && algorithm !== "astar") {
      node.status = "pruned";
      continue;
    }
    node.status = "expanded";
    closed.add(node.mask);
    steps.push({ index: steps.length, node: id, mask: node.mask, g: r2(node.g), h: r2(node.h), note: `Expand ${node.depth} check(s), g=${r2(node.g)}, h=${r2(node.h)}` });
    if (isGoal(p, node.mask)) return finish(p, algorithm, tree, steps, id, t0, "Goal reached: enough evidence gathered.");
    if (steps.length >= maxExpansions) return finish(p, algorithm, tree, steps, null, t0, `Stopped at the ${maxExpansions}-expansion limit.`);

    for (let c = 0; c < n; c++) {
      if (node.mask & (1 << c)) continue;
      const mask = node.mask | (1 << c);
      const g = node.g + p.checks[c]!.cost;
      const h = heuristic(p, mask);
      const child: TreeNode = { id: tree.length, parent: id, mask, check: c, g, h, depth: node.depth + 1, status: "frontier" };
      tree.push(child);
      const known = bestG.get(mask);
      // A* re-opens a closed state when a cheaper g appears; others never re-open.
      if (h === Infinity || (known !== undefined && g >= known - 1e-12) || (closed.has(mask) && algorithm !== "astar")) {
        child.status = "pruned";
        continue;
      }
      bestG.set(mask, g);
      closed.delete(mask);
      heap.push(priority(g, h), child.id);
    }
  }
  return finish(p, algorithm, tree, steps, null, t0, "Frontier exhausted without reaching the goal.");
}

export const ucs = (p: Problem, max = 5000) => bestFirst(p, "ucs", (g) => g, max);
export const astar = (p: Problem, max = 5000) => bestFirst(p, "astar", (g, h) => g + h, max);
export const greedy = (p: Problem, max = 5000) => bestFirst(p, "greedy", (_g, h) => h, max);

/** Fewest checks, ignoring cost. Goal test when a node is expanded. */
export function bfs(p: Problem, max = 5000): PlanResult {
  const t0 = performance.now();
  const tree: TreeNode[] = [{ id: 0, parent: null, mask: 0, check: null, g: 0, h: heuristic(p, 0), depth: 0, status: "frontier" }];
  const steps: SearchStep[] = [];
  const seen = new Set<number>([0]);
  const queue = [0];
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi]!;
    const node = tree[id]!;
    node.status = "expanded";
    steps.push({ index: steps.length, node: id, mask: node.mask, g: r2(node.g), h: r2(node.h), note: `Expand depth ${node.depth}` });
    if (isGoal(p, node.mask)) return finish(p, "bfs", tree, steps, id, t0, "Goal reached with the fewest checks — cost was ignored.");
    if (steps.length >= max) return finish(p, "bfs", tree, steps, null, t0, `Stopped at the ${max}-expansion limit.`);
    for (let c = 0; c < p.checks.length; c++) {
      if (node.mask & (1 << c)) continue;
      const mask = node.mask | (1 << c);
      const child: TreeNode = { id: tree.length, parent: id, mask, check: c, g: node.g + p.checks[c]!.cost, h: heuristic(p, mask), depth: node.depth + 1, status: "frontier" };
      tree.push(child);
      if (seen.has(mask)) {
        child.status = "pruned";
        continue;
      }
      seen.add(mask);
      queue.push(child.id);
    }
  }
  return finish(p, "bfs", tree, steps, null, t0, "No goal state exists.");
}

/**
 * Steepest-ascent hill climbing on gain/cost, no random restarts. At each step
 * it takes the neighbour with the best gain per unit cost; it stops at a local
 * maximum when no remaining check adds any evidence.
 */
export function hillClimb(p: Problem): PlanResult {
  const t0 = performance.now();
  const tree: TreeNode[] = [{ id: 0, parent: null, mask: 0, check: null, g: 0, h: heuristic(p, 0), depth: 0, status: "expanded" }];
  const steps: SearchStep[] = [{ index: 0, node: 0, mask: 0, g: 0, h: r2(tree[0]!.h), note: "Start with no checks." }];
  let cur = 0;
  for (;;) {
    const node = tree[cur]!;
    if (isGoal(p, node.mask)) return finish(p, "hill", tree, steps, cur, t0, "Goal reached by always taking the best gain per cost — not guaranteed cheapest.");
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < p.checks.length; c++) {
      if (node.mask & (1 << c)) continue;
      const ch = p.checks[c]!;
      const mask = node.mask | (1 << c);
      tree.push({ id: tree.length, parent: cur, mask, check: c, g: node.g + ch.cost, h: heuristic(p, mask), depth: node.depth + 1, status: "pruned" });
      const score = ch.gain / ch.cost;
      if (score > bestScore + 1e-12) {
        bestScore = score;
        best = tree.length - 1;
      }
    }
    if (best === -1) {
      return finish(p, "hill", tree, steps, null, t0, "Stuck at a local maximum: no remaining check adds evidence, but the goal is not reached.");
    }
    tree[best]!.status = "expanded";
    const b = tree[best]!;
    steps.push({ index: steps.length, node: best, mask: b.mask, g: r2(b.g), h: r2(b.h), note: `Take ${p.checks[b.check!]!.label} (gain/cost ${r2(bestScore)})` });
    cur = best;
  }
}

export function run(id: AlgorithmId, p: Problem): PlanResult {
  switch (id) {
    case "bfs":
      return bfs(p);
    case "ucs":
      return ucs(p);
    case "astar":
      return astar(p);
    case "greedy":
      return greedy(p);
    case "hill":
      return hillClimb(p);
  }
}
