/**
 * Step costs for each verification check. Units are abstract "effort points"
 * combining latency and API credits:
 *  - local language checks run in-process in microseconds and cost nothing -> 1
 *  - the official-source lookup is a local keyword match -> 1
 *  - fact-check lookup: one external HTTP call to a free API (~0.5-2 s) -> 2
 *  - news search: slower external call, often rate-limited -> 3
 *  - Gemini: paid AI credits plus the slowest latency -> 4
 */
export const COST_LOCAL = 1;
export const COST_OFFICIAL_LOOKUP = 1;
export const COST_FACTCHECK = 2;
export const COST_NEWS = 3;
export const COST_GEMINI = 4;

/** Goal threshold: gather tau x (all available evidence). */
export const DEFAULT_TAU = 0.6;

/*
 * Gain ESTIMATES for external checks (we cannot know the result before running
 * them). Local checks are worth at most 1 each, so a decisive external source
 * is scored on a larger scale. Tunable; labelled as estimates in the UI.
 */
export const GAIN_FACTCHECK_BASE = 1.5;
/** Topics that fact-checkers in India publish on most. */
export const GAIN_FACTCHECK_TOPIC_BONUS = 1.0;
/** Viral, high-pressure wording is what fact-checkers usually pick up. */
export const GAIN_FACTCHECK_VIRAL_BONUS = 0.5;
export const GAIN_NEWS_BASE = 1.0;
/** Dates and named bodies make a claim searchable in news coverage. */
export const GAIN_NEWS_SPECIFIC_BONUS = 1.0;
export const GAIN_GEMINI = 0.6;
export const FACTCHECKED_TOPICS = ["health", "policy", "elections", "economy", "digital"] as const;
