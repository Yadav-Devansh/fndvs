# Make the codebase viva-ready (structure + explanatory comments)

Goal: when the repo is opened in VS Code, a reader can find any feature quickly and understand important code from its comments alone. No behaviour, scores, verdicts or UI change.

## 1. Clean, predictable structure (low-risk)
Files are NOT physically moved (moving risks breaking imports the night before the viva). Instead:
- Add a short `README.md` inside each key folder explaining what lives there and how it connects:
  `src/routes/`, `src/routes/api/public/`, `src/components/`, `src/components/ai-search/`, `src/lib/detect/`, `src/lib/planner/`, `src/lib/evidence/`, `scripts/`, `eval/`, `docs/`.
- Remove leftovers that confuse readers: unused files and dead imports (verified with a search before deleting; evidence code stays since it is used by the planner/verify endpoint).
- Add `docs/CODE_TOUR.md`: a "start here" guide — request flow (Submit -> rule engine -> Gemini -> Result), AI Search flow (claim -> problem -> algorithms -> tree -> inference), a file map table, and likely viva questions with the file/function that answers each.
- Add `.vscode/settings.json` + `extensions.json` (hide `node_modules`, `routeTree.gen.ts` folded, recommended Tailwind/ESLint extensions).
- Refresh root `README.md` so it matches the current app (wording + Gemini, no fact-check in UI, image extraction, AI Search tabs).

## 2. Explanatory comments on important code
Each important file gets a header block (purpose, inputs/outputs, who calls it) and inline comments at key steps, in plain English:
- Rule engine: `src/lib/detect/*` (tokenizing, lexicon signals, risk score formula, verdict thresholds), `src/lib/predict.ts`.
- Planner: `problem.ts` (state = bitmask of checks, goal test, gains), `costs.ts`, `search.ts` (BFS, UCS, A*, Greedy, Hill Climbing — frontier, g/h/f, why heuristic is admissible).
- Gemini/AI: `gateway.server.ts` (retries, model config), `api/public/ai-verify.ts` (extract / opinion actions), `src/lib/gemini.ts` (image downscaling).
- API safety: `api-guard.server.ts` (validation, size and rate limits).
- Storage: `src/lib/store.ts` (localStorage records).
- Pages: `submit.tsx`, `result.$submissionId.tsx`, `ai-search.tsx`, and the ai-search components (tree layout, inspector, inference).
- Tests: one-line comment per test group saying what rule it proves.

Comments explain *why*, not restate each line; generated files (`routeTree.gen.ts`, backend client files, `components/ui/*`) are left untouched.

## 3. Verify
Run tests (incl. scoring snapshot) and confirm the build is clean so nothing changed functionally.

## Technical notes
- Comment-only edits plus new markdown/VS Code config; snapshot test must pass unchanged.
- No folder renames; Git sync picks up the changes automatically.
