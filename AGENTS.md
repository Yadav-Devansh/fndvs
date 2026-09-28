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

- DWM historical analysis: shared `src/lib/dwm/pipeline.ts` is used by both the browser worker (`dwm.worker.ts`) and `scripts/build-dwm-aggregates.ts`; the app ships only aggregates (`public/data/dwm-aggregates.json`, cube of sums + 10k sample), never raw data — why: bounded memory, exact roll-ups, identical results on both paths.
