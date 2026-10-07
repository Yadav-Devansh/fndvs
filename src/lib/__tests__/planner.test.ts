import { describe, expect, it } from "vitest";
import { analyze } from "../detect";
import { astar, bfs, ucs, problemFor, heuristic, isGoal, FULL, EPS, type Problem } from "../planner";

const CLAIMS = [
  "URGENT!!! FORWARD THIS TO EVERYONE — the government is switching off all SIM cards not linked to Aadhaar by Friday! SHOCKING!",
  "The Reserve Bank of India announced in its monetary policy statement that the repo rate will remain unchanged at 6.5 percent.",
  "According to a statement by the Ministry of Health, drinking hot water every hour cures covid, officials confirmed on 3 March 2025.",
  "The India Meteorological Department issued an orange alert for coastal districts, forecasting heavy rainfall over the next day.",
  "The government has quietly decided to ban all cash transactions above Rs 2000 from next month, as per the Ministry of Finance.",
];
const problems = CLAIMS.map((t) => problemFor(analyze(t)));

/** True optimal remaining cost for every state, by dynamic programming over supersets. */
function hStar(p: Problem): Float64Array {
  const full = FULL(p);
  const out = new Float64Array(full + 1).fill(Infinity);
  for (let m = full; m >= 0; m--) {
    if (isGoal(p, m)) {
      out[m] = 0;
      continue;
    }
    for (let c = 0; c < p.checks.length; c++) {
      if (m & (1 << c)) continue;
      out[m] = Math.min(out[m]!, p.checks[c]!.cost + out[m | (1 << c)]!);
    }
  }
  return out;
}

describe("planner", () => {
  it("has 11 checks and 2048 states", () => expect(FULL(problems[0]!) + 1).toBe(2048));

  it("1. admissibility: h(S) <= h*(S) for every state", () => {
    for (const p of problems) {
      const hs = hStar(p);
      for (let m = 0; m <= FULL(p); m++) expect(heuristic(p, m)).toBeLessThanOrEqual(hs[m]! + 1e-6);
    }
  });

  it("2. consistency: h(S) <= cost(c) + h(S')", () => {
    for (const p of problems) {
      for (let m = 0; m <= FULL(p); m++) {
        const h = heuristic(p, m);
        for (let c = 0; c < p.checks.length; c++) {
          if (m & (1 << c)) continue;
          expect(h).toBeLessThanOrEqual(p.checks[c]!.cost + heuristic(p, m | (1 << c)) + 1e-6);
        }
      }
    }
  });

  it("3. optimality: A* cost = UCS cost <= BFS cost; A* expands <= UCS", () => {
    for (const p of problems) {
      const a = astar(p);
      const u = ucs(p);
      const b = bfs(p);
      expect(a.cost).toBeCloseTo(u.cost, 6);
      expect(a.cost).toBeLessThanOrEqual(b.cost + EPS);
      expect(a.expanded).toBeLessThanOrEqual(u.expanded);
    }
  });

  it("4. claim sensitivity: shouty forward-chain vs calm policy plans differ", () => {
    expect(astar(problems[0]!).plan).not.toEqual(astar(problems[1]!).plan);
  });

  it("5. goal reachable when every local score is 50 — plan uses external checks", () => {
    const r = analyze(CLAIMS[1]!);
    const flat = { ...r, aspects: r.aspects.map((a) => ({ ...a, score: 50 })) };
    const p = problemFor(flat);
    const res = astar(p);
    expect(res.goalReached).toBe(true);
    expect(res.plan.every((i) => p.checks[i]!.kind === "external")).toBe(true);
    for (const p2 of problems) expect(astar(p2).goalReached).toBe(true);
  });

  it("6. determinism: same input -> identical plan", () => {
    for (const t of CLAIMS) expect(astar(problemFor(analyze(t))).plan).toEqual(astar(problemFor(analyze(t))).plan);
  });
});
