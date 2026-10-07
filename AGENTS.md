<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Rule-engine scoring is pinned by a vitest snapshot in `src/lib/__tests__/predict.test.ts` — why: engine changes must be deliberate and reviewable.
- The result page shows the rule-engine (wording/tone) verdict beside an independent Gemini opinion; fact-check/news lookups are not run from the UI (server code in `src/lib/evidence/` kept, unused) — why: user chose algorithm + tone over external evidence. Gemini never alters the engine verdict.
- Public API routes use `src/lib/api-guard.server.ts` for zod-validated bodies, size limits, per-IP rate limits and JSON errors, and never log claim text — why: the endpoints are unauthenticated.
- The AI Search lab and /api/public/verify share the planner in `src/lib/planner/` (check sets as bitmasks, fractional-knapsack heuristic proven admissible/consistent by tests) — why: the plan shown in the lab is the plan actually executed.
- AI model id and gateway URL live in `src/lib/evidence/gateway.server.ts` with optional AI_MODEL / AI_GATEWAY_URL env overrides — why: one place to change or verify the model.
- Offline evaluation lives in `eval/claims.jsonl` + `scripts/evaluate.ts` (rule engine only) — why: numbers must be reproducible without network or keys.
