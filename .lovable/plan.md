# Upgrade the DWM lab: five-year Indian headlines analysis

The goal is to turn `/dwm` from "analyse my few saved claims" into "analyse five years of Indian news headlines and give one final inference", as the uploaded brief asks. The verify flow, the scoring engine, the AI Search lab and the API routes stay exactly as they are.

## What you will see

- **`/dwm`** opens with a **Final Inference** panel: one headline sentence, 5 to 7 key findings, a "What this means for readers" section, confidence and limits, method chips, and Copy / Download report (Markdown) buttons. Below it:
  - a dataset badge showing the source, window, rows read, kept and scored, and whether the data is real or synthetic
  - a toggle to show the historical dataset, user-submitted claims, or both
  - tabs: Trends, Categories, Credibility aspects, Clusters, Association rules, Validation, Warehouse, User-submitted
- **`/dwm/import`** is where you load the data. You can upload the headlines file (CSV, TSV, gzipped CSV, JSON or JSONL), check the column mapping, pick the window (3, 5 or 10 years, counted back from the dataset's own last date), and choose between all rows or a sample. It shows live progress with a Cancel button and a data-quality funnel (read, kept, scored). There is an optional second upload for a labelled fake-news set such as IFND. You can also load or download the finished results file, or load synthetic demo data.
- **Wording:** headline results are always called the **"risk-signal rate"**, never "percent fake". The required footnote is shown next to the inference.
- **Demo data:** every screen that uses it carries a yellow "SYNTHETIC DEMO DATA" banner, and the inference text starts with "Demo only:".
- **Help** gets a new section covering the dataset sources, the method, the limitations, and a "Clear loaded dataset" button.

## How the data gets in (in this order)

1. **Automatic download.** A one-time server-side attempt to fetch the Times of India headlines from Hugging Face for the five-year window. If it works, the ready-made results file is bundled with the app, so `/dwm` works for everyone straight away.
2. **If that fails**, nothing is made up. The import page shows exactly which file to download and which columns it needs.
3. **An offline script** (`bun run dwm:build`) can turn the full 3.3M-row CSV into the same results file.
4. **Demo mode**, so every chart can be shown in the presentation before the real data is loaded.

## Build order

1. Confirm the scorer is pure and can run in a background thread. Add a test that 200 fixed headlines score exactly the same as before.
2. Shared pipeline: cleaning, date-format detection, category normalisation, duplicate removal using hashes, a data cube of (year, month, category) sums, and a 20k-row sample stratified by year. Unit tests on tiny fixtures, including a check that roll-up totals equal the row count.
3. The offline Bun script, plus a small, clearly fake fixture CSV.
4. The background worker (streaming, bounded memory, progress, cancel) and the `/dwm/import` page. Results are saved in browser IndexedDB, with JSON download and load.
5. Extend the star schema with `Dim_Dataset` and quarter, and move OLAP (slice, dice, roll-up, drill-down) onto the cube. The existing user-submitted views keep working.
6. Tabs and charts:
   - Trends: monthly rate with a moving average, year-over-year change in percentage points, a least-squares slope with R², and spikes marked against the event list using "coincides with" wording
   - Categories: rate per category and a category-by-year heatmap
   - Aspects: a radar chart and per-year lines
7. Mining:
   - K-Means with an elbow chart, a silhouette score and clusters named from their centroids
   - a new Apriori module with support and confidence sliders and a rules table showing lift
   - a new Naive Bayes module
8. Validation tab: the cut-off is chosen on a 70% training split and scored on the 30% test split. It shows the confusion matrix, precision, recall and F1, the majority-class baseline, Naive Bayes side by side, and the limitations.
9. The Final Inference panel and the Markdown report, all generated from the data. If fewer than 1,000 rows are scored, it shows "Not enough data" instead.
10. Demo mode, Help updates, empty states, readable error messages, and layout checks down to 360 px in both light and dark theme.
11. Walk through the acceptance checklist and report what passed, which data path was used, and what you need to download or upload.

## Technical details

- New files:
  - `src/lib/dwm/pipeline.ts`: shared by the worker and the script
  - `src/lib/dwm/dwm.worker.ts`: a Vite module worker
  - `src/lib/dwm/apriori.ts`
  - `src/lib/dwm/naiveBayes.ts`
  - `src/lib/dwm/trends.ts`
  - `src/lib/dwm/idb.ts`
  - `src/lib/dwm/demo.ts`
  - `src/routes/dwm.import.tsx`
  - `scripts/build-dwm-aggregates.ts`
  - `scripts/fixtures/`
- If `predict.ts` needs browser APIs, its pure part moves to `src/lib/scoring/core.ts` and both old and new code import it. Its outputs stay identical.
- Vitest is added as a dev dependency for the tests.
- Hugging Face data is fetched only server-side or from the script, never from the browser. Dataset text is never sent to any AI service.
- The bundled `public/data/dwm-aggregates.json` is capped at about 5 MB (the cube, top keywords and a 10k sample). No raw dataset is committed.
- The optional cloud table for saving datasets is skipped. IndexedDB plus the bundled JSON covers what the brief requires.
- `dwm.tsx` (40k chars) gets split into per-tab components under `src/components/dwm/`.
