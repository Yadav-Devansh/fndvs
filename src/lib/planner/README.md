# planner/ - AI search problem
- costs.ts: cost per check (effort units) and gain estimates.
- problem.ts: problemFor(claim) builds checks; state = bitmask; isGoal = evidence >= tau x total; heuristic h = fractional-knapsack lower bound (admissible + consistent).
- search.ts: BFS, UCS, A*, Greedy, Hill Climbing. Each returns plan, cost, expansions and the explored tree.
Used by the AI Search page. Tested in __tests__/planner.test.ts. Theory: docs/AI_PLANNER.md.
