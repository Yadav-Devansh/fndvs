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
- Final verdicts come only from `decide()` in `src/lib/evidence/decide.ts` (unit-tested); wording signals and Gemini can never produce "likely-credible" on their own — why: agreement between unverified opinions is not verification.
- Public API routes use `src/lib/api-guard.server.ts` for zod-validated bodies, size limits, per-IP rate limits and JSON errors, and never log claim text — why: the endpoints are unauthenticated.
