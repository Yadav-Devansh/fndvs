/**
 * Classical AI search over the FNDVS verification process.
 *
 * The detection engine is untouched: these algorithms only search the ORDER of
 * verification actions. They do not decide whether a claim is true.
 */

export type StateKind = "start" | "topic" | "aspect" | "source" | "corroboration" | "goal";

export interface AiState {
  id: string;
  code: string;
  label: string;
  kind: StateKind;
  aspectId?: string;
  detail: string;
}

export interface AiEdge {
  from: string;
  to: string;
  action: string;
  cost: number;
}

export interface HeuristicBreakdown {
  topicRelevance: number;
  sourceRelevance: number;
  credibilityConcern: number;
  evidenceAvailability: number;
  uncertaintyReduction: number;
  /** Normalised 0-100 "how promising is this state" score. */
  promise: number;
  /** Estimated remaining cost to the goal, used as h(n) in A*. */
  hCost: number;
  stepsToGoal: number;
}

export interface HeuristicWeights {
  topicRelevance: number;
  sourceRelevance: number;
  credibilityConcern: number;
  evidenceAvailability: number;
  uncertaintyReduction: number;
}

export interface SearchOptions {
  /** Deepest level the search may expand into. */
  maxDepth: number;
  /** Hard cap on the number of state expansions (iterations). */
  maxIterations: number;
  /** Beam width — how many states may be kept on the frontier at once. */
  maxFrontier: number;
}

export interface AiGraph {
  states: AiState[];
  byId: Record<string, AiState>;
  edges: Record<string, AiEdge[]>;
  start: string;
  goal: string;
  heuristics: Record<string, HeuristicBreakdown>;
}

export interface Candidate {
  id: string;
  label: string;
  g: number;
  h: number;
  f: number;
  promise: number;
  selected: boolean;
  /** Set when a limit stopped this candidate from entering the frontier. */
  pruned?: string;
}

export interface SearchStep {
  index: number;
  current: string;
  frontier: string[];
  explored: string[];
  candidates: Candidate[];
  selected?: string;
  note: string;
  depth: number;
}

export type AlgorithmId = "bfs" | "best-first" | "hill-climbing" | "astar";

export interface SearchResult {
  algorithm: AlgorithmId;
  algorithmName: string;
  searchType: string;
  path: string[];
  pathLength: number;
  nodesExplored: number;
  /** Number of state expansions performed (iterations of the main loop). */
  expansions: number;
  /** Wall-clock runtime of the search, in milliseconds. */
  runtimeMs: number;
  /** Largest frontier size observed during the run. */
  peakFrontier: number;
  /** True when a configured limit stopped the search early. */
  limitHit?: string;
  searchCost: number;
  maxDepth: number;
  goalReached: boolean;
  steps: SearchStep[];
  note: string;
}
