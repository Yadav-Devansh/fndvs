# Code Tour - start here

## 1. What the app does
1. User enters a claim (or a screenshot) on **Verify**.
2. The **rule engine** scores the wording/tone (no internet).
3. **Gemini** gives a separate opinion.
4. **Result** shows both side by side. Records are saved in the browser.
5. **AI Search** shows how search algorithms plan the cheapest set of verification checks.

## 2. Request flow
```text
submit.tsx --image--> /api/public/ai-verify (extract) --> text
submit.tsx --text---> /api/public/predict --> lib/detect analyze() --> risk + verdict
                     lib/store.ts saves record --> result.$submissionId.tsx
result page --------> /api/public/ai-verify (opinion) --> Gemini verdict
```

## 3. AI Search flow
```text
claim -> planner/problem.ts problemFor()  (checks, costs, gains, threshold)
      -> planner/search.ts bfs/ucs/astar/greedy/hillClimb
      -> tabs: PlanList | SearchTree + NodeInspector | SearchInference
```

## 4. File map
| Topic | File |
|---|---|
| Wording score | src/lib/detect/index.ts |
| Word lists | src/lib/detect/lexicon.ts |
| Check costs | src/lib/planner/costs.ts |
| State, goal, heuristic | src/lib/planner/problem.ts |
| Algorithms | src/lib/planner/search.ts |
| Gemini calls | src/lib/evidence/gateway.server.ts |
| Image endpoint | src/routes/api/public/ai-verify.ts |
| API safety | src/lib/api-guard.server.ts |
| Storage | src/lib/store.ts |
| Tests | src/lib/__tests__/ |

## 5. Likely viva questions
- **What is a state?** A set of checks, stored as a bitmask (problem.ts).
- **What are g, h, f?** g = cost so far, h = estimated remaining cost, f = g + h (search.ts, bestFirst).
- **Why is A* optimal?** h is a fractional-knapsack lower bound, so it never overestimates (admissible); tested in planner.test.ts.
- **BFS vs A*?** BFS minimises number of checks; A* minimises total cost with fewer expansions than UCS.
- **Why can Hill Climbing fail?** No backtracking; it stops at a local maximum.
- **How is the risk score computed?** Weighted lexicon signals summed and capped at 100 (detect/index.ts).
- **Can the app say something is true?** No: wording alone never makes a claim credible.
- **How does image extraction work?** Browser downscales the image, Gemini transcribes it (ai-verify.ts, gemini.ts).
- **Where is data stored?** localStorage in the browser (store.ts).
- **How do you protect the API?** zod validation, size limits, per-IP rate limits (api-guard.server.ts).
