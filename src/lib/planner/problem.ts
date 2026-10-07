/**
 * The planning problem: "Verification checks cost time and API credits. Given
 * this claim, find the cheapest set and order of checks that gathers enough
 * evidence to be confident, and stop there."
 *
 *  State      the SET of checks already performed, as an 11-bit mask (2048 states)
 *  Initial    the empty set (mask 0)
 *  Action     run one check c not yet in S
 *  Transition S -> S ∪ {c}, step cost = cost(c)
 *  Evidence   E(S) = Σ gain(c) for c in S
 *  Goal       E(S) >= T, T = tau × Σ all gains
 *  Objective  minimise total path cost
 */
import type { DetectionResult } from "../detect";
import * as C from "./costs";

export type CheckKind = "local" | "external";

export interface Check {
  id: string;
  label: string;
  kind: CheckKind;
  cost: number;
  gain: number;
  /** True for gains that are estimates rather than measured results. */
  estimated: boolean;
  why: string;
}

export interface Problem {
  checks: Check[];
  tau: number;
  total: number;
  threshold: number;
}

export const EPS = 1e-9;
export const FULL = (p: Problem) => (1 << p.checks.length) - 1;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function localGain(score: number | null): number {
  return score === null ? 0 : round2(Math.abs(score - 50) / 50);
}

export function makeProblem(checks: Check[], tau = C.DEFAULT_TAU): Problem {
  const total = checks.reduce((s, c) => s + c.gain, 0);
  return { checks, tau, total, threshold: tau * total };
}

export interface ProblemOverrides {
  tau?: number;
  costs?: Partial<Record<string, number>>;
}

/** Builds the 11-check problem from the real local aspect results of a claim. */
export function problemFor(r: DetectionResult, o: ProblemOverrides = {}): Problem {
  const local: Check[] = r.aspects.map((a) => ({
    id: a.id,
    label: a.id === "corroboration" ? "Official-source lookup" : a.label,
    kind: "local",
    cost: a.id === "corroboration" ? C.COST_OFFICIAL_LOOKUP : C.COST_LOCAL,
    gain: localGain(a.score),
    estimated: false,
    why: a.score === null ? "Not scored locally — no evidence gain." : `Aspect score ${a.score}/100 → |score − 50| / 50.`,
  }));

  const checkable = r.topics.some((t) => (C.FACTCHECKED_TOPICS as readonly string[]).includes(t));
  const viral = r.languageRisk === "high";
  const specific = r.dates.length > 0 || r.namedBodies.length > 0;
  const english = r.language === "english";

  const external: Check[] = [
    {
      id: "factcheck",
      label: "Fact-check lookup",
      kind: "external",
      cost: C.COST_FACTCHECK,
      gain: round2(C.GAIN_FACTCHECK_BASE + (checkable ? C.GAIN_FACTCHECK_TOPIC_BONUS : 0) + (viral ? C.GAIN_FACTCHECK_VIRAL_BONUS : 0)),
      estimated: true,
      why: `Estimate: base ${C.GAIN_FACTCHECK_BASE}${checkable ? " + often fact-checked topic" : ""}${viral ? " + viral wording" : ""}.`,
    },
    {
      id: "news",
      label: "News search",
      kind: "external",
      cost: C.COST_NEWS,
      gain: round2((C.GAIN_NEWS_BASE + (specific ? C.GAIN_NEWS_SPECIFIC_BONUS : 0)) * (english ? 1 : 0.5)),
      estimated: true,
      why: `Estimate: base ${C.GAIN_NEWS_BASE}${specific ? " + dates/named bodies" : ""}${english ? "" : ", halved for non-English"}.`,
    },
    {
      id: "gemini",
      label: "Gemini (evidence-only)",
      kind: "external",
      cost: C.COST_GEMINI,
      gain: C.GAIN_GEMINI,
      estimated: true,
      why: "Estimate: summarises other evidence, adds little on its own.",
    },
  ];

  const checks = [...local, ...external].map((c) => ({ ...c, cost: o.costs?.[c.id] ?? c.cost }));
  return makeProblem(checks, o.tau ?? C.DEFAULT_TAU);
}

export function evidence(p: Problem, mask: number): number {
  let e = 0;
  for (let i = 0; i < p.checks.length; i++) if (mask & (1 << i)) e += p.checks[i]!.gain;
  return e;
}

export const isGoal = (p: Problem, mask: number) => evidence(p, mask) >= p.threshold - EPS;

/**
 * Fractional-knapsack relaxation. Cover the remaining need T − E(S) with the
 * cheapest cost-per-gain checks, allowing a fraction of the last one. Allowing
 * fractions can only make the cover cheaper or equal, so h never overestimates
 * (admissible); taking any check c whole is one feasible relaxed solution, so
 * h(S) <= cost(c) + h(S ∪ {c}) (consistent).
 */
export function heuristic(p: Problem, mask: number): number {
  let need = p.threshold - evidence(p, mask);
  if (need <= EPS) return 0;
  const rest = p.checks
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => !(mask & (1 << i)) && c.gain > 0)
    .sort((a, b) => a.c.cost / a.c.gain - b.c.cost / b.c.gain || a.i - b.i);
  let h = 0;
  for (const { c } of rest) {
    if (c.gain >= need) return h + (c.cost * need) / c.gain;
    h += c.cost;
    need -= c.gain;
  }
  return need <= EPS ? h : Infinity;
}

export function setLabel(p: Problem, mask: number): string {
  if (mask === 0) return "{ }";
  return `{${p.checks.filter((_, i) => mask & (1 << i)).map((c) => c.label).join(", ")}}`;
}
