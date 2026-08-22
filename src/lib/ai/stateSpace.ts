import type { PredictionResult } from "@/lib/predict";
import type { AiEdge, AiGraph, AiState, HeuristicWeights } from "./types";
import { buildHeuristics } from "./heuristic";

/** Aspect states S2..S8 in syllabus order; corroboration is modelled as S10. */
const ASPECT_ORDER = [
  { id: "attribution", code: "S2", label: "Source Attribution Checked" },
  { id: "sensational", code: "S3", label: "Sensational Vocabulary Checked" },
  { id: "emotion", code: "S4", label: "Emotional Tone Checked" },
  { id: "urgency", code: "S5", label: "Urgency Checked" },
  { id: "specificity", code: "S6", label: "Factual Specificity Checked" },
  { id: "style", code: "S7", label: "Writing Style Checked" },
  { id: "clickbait", code: "S8", label: "Clickbait Framing Checked" },
] as const;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Edge cost = estimated verification effort. Healthy aspects cost more to
 *  re-check (low information gain); concerning aspects are cheap and useful. */
function aspectCost(score: number) {
  return round1(1 + (score / 100) * 2);
}

export function buildStateSpace(
  result: PredictionResult,
  weights?: Partial<HeuristicWeights>,
): AiGraph {
  const scoreOf = (id: string) => result.aspects.find((a) => a.id === id)?.score ?? 50;
  const topSource = result.sources[0];
  const topicLabel = result.topics[0] ?? "general";

  const states: AiState[] = [
    {
      id: "S0",
      code: "S0",
      label: "Claim Received",
      kind: "start",
      detail: "Initial state — raw claim text entered into FNDVS.",
    },
    {
      id: "S1",
      code: "S1",
      label: "Topic Identified",
      kind: "topic",
      detail: `Subject area detected by the existing engine: ${result.topics.join(", ")}.`,
    },
    ...ASPECT_ORDER.map((a) => ({
      id: a.code,
      code: a.code,
      label: a.label,
      kind: "aspect" as const,
      aspectId: a.id,
      detail: `Existing FNDVS aspect score: ${scoreOf(a.id)}/100.`,
    })),
    {
      id: "S9",
      code: "S9",
      label: "Relevant Official Source Identified",
      kind: "source",
      detail: topSource
        ? `Best-matching desk for "${topicLabel}": ${topSource.source.shortName} (relevance ${topSource.relevance}).`
        : "No topic-specific desk matched; PIB Fact Check is the general fallback.",
    },
    {
      id: "S10",
      code: "S10",
      label: "Official Corroboration Checked",
      kind: "corroboration",
      aspectId: "corroboration",
      detail: `Existing corroboration aspect score: ${scoreOf("corroboration")}/100.`,
    },
    {
      id: "S11",
      code: "S11",
      label: "Verification Complete",
      kind: "goal",
      detail: "Goal state — enough checks performed to hand back to the FNDVS report.",
    },
  ];

  const edges: Record<string, AiEdge[]> = {};
  const add = (from: string, to: string, action: string, cost: number) => {
    (edges[from] ??= []).push({ from, to, action, cost: round1(cost) });
  };

  add("S0", "S1", "Identify Topic", 1);
  for (const a of ASPECT_ORDER) {
    add("S1", a.code, `Check ${a.label.replace(" Checked", "")}`, aspectCost(scoreOf(a.id)));
  }
  add("S1", "S9", "Check Relevant Official Source", 1.5);

  ASPECT_ORDER.forEach((a, i) => {
    for (const next of ASPECT_ORDER.slice(i + 1)) {
      add(a.code, next.code, `Check ${next.label.replace(" Checked", "")}`, aspectCost(scoreOf(next.id)));
    }
    add(a.code, "S9", "Identify Relevant Official Source", 1.5);
  });

  add("S9", "S10", "Check Official Corroboration", aspectCost(scoreOf("corroboration")));
  add("S10", "S11", "Complete Verification", 0.5);

  const byId: Record<string, AiState> = {};
  for (const s of states) byId[s.id] = s;

  const graph: AiGraph = {
    states,
    byId,
    edges,
    start: "S0",
    goal: "S11",
    heuristics: {},
  };
  graph.heuristics = buildHeuristics(graph, result, weights);
  return graph;
}

/** Unweighted shortest-step distance to the goal (used by the heuristic). */
export function stepsToGoal(graph: AiGraph): Record<string, number> {
  const dist: Record<string, number> = { [graph.goal]: 0 };
  let changed = true;
  while (changed) {
    changed = false;
    for (const state of graph.states) {
      const outs = graph.edges[state.id] ?? [];
      let best = Infinity;
      for (const e of outs) {
        const d = dist[e.to];
        if (d !== undefined && d + 1 < best) best = d + 1;
      }
      const cur = dist[state.id];
      if (best !== Infinity && (cur === undefined || best < cur)) {
        dist[state.id] = best;
        changed = true;
      }
    }
  }
  return dist;
}
