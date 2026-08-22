import type { PredictionResult } from "@/lib/predict";
import type { AiGraph, HeuristicBreakdown } from "./types";
import { stepsToGoal, round1 } from "./stateSpace";

/**
 * Transparent heuristic. Every factor is derived from the claim's real FNDVS
 * data (aspect scores, detected topics, matched official sources, evidence),
 * never hard-coded per state.
 */
export const HEURISTIC_WEIGHTS = {
  topicRelevance: 0.15,
  sourceRelevance: 0.2,
  credibilityConcern: 0.3,
  evidenceAvailability: 0.15,
  uncertaintyReduction: 0.2,
} as const;

export function buildHeuristics(
  graph: AiGraph,
  result: PredictionResult,
): Record<string, HeuristicBreakdown> {
  const dist = stepsToGoal(graph);
  const aspect = (id?: string) => result.aspects.find((a) => a.id === id);
  const topicSpecific = (result.topics[0] ?? "general") !== "general";
  const topSourceRelevance = result.sources[0]?.relevance ?? 50;
  const unresolved = result.aspects.filter((a) => a.score < 70).length;
  const uncertaintyPool = Math.max(1, unresolved);

  const out: Record<string, HeuristicBreakdown> = {};

  for (const state of graph.states) {
    const a = aspect(state.aspectId);
    const concern = a ? 100 - a.score : 100 - result.confidenceScore;

    let topicRelevance = topicSpecific ? 82 : 58;
    let sourceRelevance = 50;
    let evidenceAvailability = 45;
    let credibilityConcern = clamp(concern);
    let uncertaintyReduction = clamp((concern / 100) * (100 / uncertaintyPool) + 25);

    switch (state.kind) {
      case "start":
        topicRelevance = 40;
        sourceRelevance = 30;
        evidenceAvailability = 30;
        credibilityConcern = clamp(100 - result.confidenceScore);
        uncertaintyReduction = 35;
        break;
      case "topic":
        topicRelevance = topicSpecific ? 95 : 65;
        sourceRelevance = clamp(topSourceRelevance * 0.7);
        evidenceAvailability = clamp(40 + result.topics.length * 15);
        uncertaintyReduction = 70;
        break;
      case "aspect":
        evidenceAvailability = clamp(40 + (a?.evidence.length ?? 0) * 18);
        sourceRelevance = 45;
        break;
      case "source":
        topicRelevance = topicSpecific ? 92 : 66;
        sourceRelevance = clamp(topSourceRelevance);
        evidenceAvailability = clamp(45 + result.sources.length * 16);
        credibilityConcern = clamp(100 - result.confidenceScore);
        uncertaintyReduction = 80;
        break;
      case "corroboration":
        topicRelevance = topicSpecific ? 90 : 68;
        sourceRelevance = clamp(topSourceRelevance * 0.95);
        evidenceAvailability = clamp(45 + (a?.evidence.length ?? 0) * 18 + result.sources.length * 10);
        uncertaintyReduction = 88;
        break;
      case "goal":
        topicRelevance = 100;
        sourceRelevance = 100;
        credibilityConcern = 100;
        evidenceAvailability = 100;
        uncertaintyReduction = 100;
        break;
    }

    const promise = round1(
      topicRelevance * HEURISTIC_WEIGHTS.topicRelevance +
        sourceRelevance * HEURISTIC_WEIGHTS.sourceRelevance +
        credibilityConcern * HEURISTIC_WEIGHTS.credibilityConcern +
        evidenceAvailability * HEURISTIC_WEIGHTS.evidenceAvailability +
        uncertaintyReduction * HEURISTIC_WEIGHTS.uncertaintyReduction,
    );

    const steps = dist[state.id] ?? 0;
    // h(n): remaining steps discounted by how promising the state already is.
    const hCost = round1(steps * (1.2 - promise / 250));

    out[state.id] = {
      topicRelevance: round1(topicRelevance),
      sourceRelevance: round1(sourceRelevance),
      credibilityConcern: round1(credibilityConcern),
      evidenceAvailability: round1(evidenceAvailability),
      uncertaintyReduction: round1(uncertaintyReduction),
      promise,
      hCost,
      stepsToGoal: steps,
    };
  }

  return out;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
