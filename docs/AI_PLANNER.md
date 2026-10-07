# AI Planner — choosing which checks to run

Code: `src/lib/planner/`. Used by the AI Search lab and by `/api/public/verify`, so the plan shown in
the lab is the plan actually executed.

## Problem statement

A claim can be checked in 11 ways: 8 local wording checks (cheap, one of which is the official-source
lookup) and 3 external lookups (fact-check search, news search, Gemini evidence read) that cost more
time and quota. Find the **cheapest set of checks** whose combined evidence gain reaches a threshold.

## Formal definition

| Element | Definition |
|---|---|
| State | A set S of checks already chosen, stored as an 11-bit mask |
| Initial state | S = {} (mask 0) |
| Actions | Add one check c not in S |
| Transition | S → S ∪ {c} |
| Step cost | cost(c): local 1, official lookup 1, fact-check 2, news 3, Gemini 4 |
| Evidence | E(S) = Σ gain(c) over c in S. Local gain = \|score − 50\| / 50; external gains are estimates |
| Goal test | E(S) ≥ T, where T = τ · Σ all gains (default τ = 0.6) |
| Path cost | g(S) = Σ cost(c) over c in S |

## Why search is needed

There are 2¹¹ = 2,048 check sets with different costs and gains. Running everything wastes calls;
picking by hand misses cheaper combinations. This is a minimum-cost covering problem, so we search.

## Algorithm comparison

| Algorithm | Complete | Optimal (min cost) | Time / space |
|---|---|---|---|
| BFS | Yes | No — fewest checks, not cheapest | O(b^d) / O(b^d) |
| UCS | Yes | Yes | O(b^(1+C*/ε)) / same |
| A* (fractional-knapsack h) | Yes | Yes (h admissible and consistent) | ≤ UCS in practice |
| Greedy best-first (h only) | Yes on finite graph | No | Usually very small |
| Hill climbing | No | No — stops at local maxima | O(steps · b) / O(b) |

### Measured on three example claims

Nodes expanded / plan cost (from `run()` in `src/lib/planner/search.ts`).

| Claim | BFS | UCS | A* | Greedy | Hill climbing |
|---|---|---|---|---|---|
| A: "URGENT: Forward this… SIM cards… Aadhaar by Friday!" | 174 / 6 | 391 / 6 | 77 / 6 | 4 / 6 | 6 / 8 |
| B: "RBI… repo rate unchanged at 6.5 percent… MoSPI" | 294 / 7 | 469 / 6 | 58 / 6 | 5 / 7 | 6 / 6 |
| C: "Ministry of Health… hot water cures covid… 3 March 2025" | 294 / 7 | 469 / 6 | 58 / 6 | 5 / 7 | 6 / 6 |

A* always matches UCS's optimal cost while expanding 5–8× fewer nodes. BFS and Greedy return
cost 7 on B and C; hill climbing returns cost 8 on A.

## The heuristic

h(S) = fractional-knapsack relaxation: cover the remaining need T − E(S) with unused checks in order
of cost/gain, allowing a fraction of the last one.

- **Admissible:** allowing fractions relaxes the problem, so the relaxed optimum can only be ≤ the
  true remaining cost. h never overestimates.
- **Consistent:** for any check c, taking c whole and then the relaxed cover of the rest is one
  feasible relaxed solution from S, so h(S) ≤ cost(c) + h(S ∪ {c}).

Both properties are checked over all states by `src/lib/__tests__/planner.test.ts`.

## Honest limits

- External-check gains are **estimates** (constants in `costs.ts`), not measured information value.
- The planner decides **how to check**, not **whether the claim is true**. Verdicts come only from
  `decide()` in `src/lib/evidence/decide.ts`.

## Likely examiner questions

**Why isn't BFS optimal here?** BFS minimises the number of steps, not cost. Steps cost 1–4, so a
3-check plan with news (3) can cost more than a 5-check plan of cheap local checks (claims B, C).

**Why isn't A* slower than UCS?** With a consistent h, A* expands only nodes with f = g + h ≤ C*,
a subset of UCS's nodes with g ≤ C*. Computing h adds small per-node work, but far fewer nodes are
expanded (58 vs 469).

**What if h overestimates?** A* may skip the optimal path and return a more expensive plan. It
stays complete but loses its optimality guarantee.

**What is the hill-climbing local maximum?** Hill climbing greedily adds the check with the best
immediate gain/cost and never backtracks. On claim A it commits to cheap local checks first and ends
at cost 8; no single-step change from there improves it, though a cost-6 plan exists.
