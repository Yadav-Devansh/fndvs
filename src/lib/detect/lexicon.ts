/** Word lists for the linguistic risk signals. Matched by whole token / phrase. */

export const SENSATIONAL_TERMS: Record<string, number> = {
  shocking: 9, miracle: 9, "you won't believe": 10, "you will not believe": 10,
  exposed: 8, secretly: 8, secret: 6, leaked: 7, rumours: 7, rumors: 7,
  viral: 5, hoax: 6, conspiracy: 8, unbelievable: 8, overnight: 5, furious: 5,
  "hidden truth": 10, "they don't want you to know": 10, "doctors hate": 10,
  "share before": 9, "forward this": 9, "must read": 7, anonymous: 5, cure: 5,
  cures: 5, banned: 5, "wake up": 6, "mainstream media": 7, "big pharma": 9,
  "100 guaranteed": 10, guaranteed: 6, "act now": 7, quietly: 4,
};

/** Neutral, informational hedging. Never counted as sensational. */
export const HEDGING_TERMS = ["claims", "claimed", "allegedly", "no evidence", "reportedly"] as const;

/** Terms not counted as sensational when the text is debunking something. */
export const DEBUNK_SUPPRESSED = ["no evidence", "claims", "viral", "hoax", "rumours", "rumors", "allegedly"];

export const DEBUNK_MARKERS = [
  "fact check", "fake news", "false claim", "misleading", "debunked", "debunk",
] as const;

export const EMOTION_TERMS = [
  "shocking", "outrageous", "furious", "terrifying", "disgusting", "horrific",
  "unbelievable", "insane", "destroyed", "slammed", "panic", "chaos", "war",
];

export const URGENCY_TERMS = [
  "share before", "forward this", "act now", "urgent", "immediately", "last chance",
  "breaking", "just in", "before it's deleted", "before it gets deleted", "deleted",
  "hurry", "only today",
];

/** Forward-chain markers: pressure to pass the message on. */
export const FORWARD_CHAIN_TERMS = [
  "forward this", "share before", "forward to everyone", "share with everyone",
  "send to everyone", "forward to all", "share this", "forward it", "to everyone",
];

export const CLICKBAIT_PATTERNS = [
  "you won't believe", "you will not believe", "what happened next", "this one trick",
  "doctors hate", "will shock you", "gone wrong", "the truth about",
];

/** Named bodies. Presence alone is NOT attribution. "who" is handled separately (uppercase only). */
export const NAMED_BODIES = [
  "ministry of finance", "ministry of health", "ministry of home affairs", "ministry",
  "government", "reserve bank of india", "rbi", "niti aayog", "isro", "icmr", "imd",
  "india meteorological department", "election commission", "uidai", "pib",
  "press information bureau", "cert in", "sebi", "world health organization",
  "commission", "department", "authority", "officials", "spokesperson", "governor",
];

export const ATTRIBUTION_VERBS = [
  "said", "says", "announced", "announces", "confirmed", "confirms", "issued", "issues",
  "stated", "states", "clarified", "notified", "told",
];

export const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];

export const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","at","by","from",
  "that","this","it","is","are","was","were","be","been","as","has","have","had",
  "will","would","not","no","its","their","they","he","she","we","you","said",
]);
