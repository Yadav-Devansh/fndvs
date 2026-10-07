# Evaluation — rule engine (offline)

Run with `bun run eval`. The script reads `eval/claims.jsonl`, runs **only** the local wording engine
(`analyze()` in `src/lib/detect`) with no network, and prints a confusion matrix, per-class precision
and recall, and a majority-class baseline. Fact-check, news and Gemini lookups are not evaluated here.

## Dataset

`eval/claims.jsonl` — one JSON object per line: `text`, `label` (`false` | `true` | `unverifiable`),
`sourceUrl`, `notes`.

- 11 seed rows: the 8 app sample claims and 3 Phase 2 test sentences. None was checked against a
  source, so all are labelled `unverifiable` with `sourceUrl: null`. No labels or links were invented.
- 10 `TODO` rows: placeholders for real labelled claims with a fact-check or official source URL.
  They are skipped until filled in.

Mapping: engine `likely-misleading` → `false`; engine `unverified` → `unverifiable`. The engine never
predicts `true` by design (wording can't establish credibility).

## Current numbers (11 labelled rows)

| actual \ predicted | false | true | unverifiable |
|---|---|---|---|
| false | 0 | 0 | 0 |
| true | 0 | 0 | 0 |
| unverifiable | 2 | 0 | 9 |

| class | precision | recall | support |
|---|---|---|---|
| false | 0.0% | n/a | 0 |
| true | n/a | n/a | 0 |
| unverifiable | 100.0% | 81.8% | 11 |

Engine accuracy 81.8%; majority-class baseline (always `unverifiable`) 100.0%.

## What this means

These numbers say almost nothing about real-world accuracy. Every labelled row is `unverifiable`,
so the baseline wins trivially, and the two "false" predictions are the shouty forward-style seed
claims, which nobody has actually fact-checked here. Real labelled claims are needed before any
accuracy claim can be made.

**The rule engine is weak against polite fakes.** It scores wording — urgency, sensational words,
forwarding pressure, clickbait framing. A false claim written calmly, with a date, a ministry name
and a number (e.g. the "hot water cures covid" test sentence) gets `unverified`, not
`likely-misleading`. That is why the final verdict depends on fact-checks and news evidence, not on
the wording engine.
