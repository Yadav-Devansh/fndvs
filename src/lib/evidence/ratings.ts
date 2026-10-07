/**
 * Maps a fact-checker's free-text rating onto a bucket with a fixed lookup table.
 * Ratings not in the table become "unknown" — never guessed.
 */
import type { RatingBucket } from "./types";

const TABLE: Record<string, RatingBucket> = {
  // false
  false: "false",
  fake: "false",
  "fake news": "false",
  "totally false": "false",
  "completely false": "false",
  "pants on fire": "false",
  incorrect: "false",
  wrong: "false",
  untrue: "false",
  "not true": "false",
  hoax: "false",
  fabricated: "false",
  baseless: "false",
  scam: "false",
  // misleading
  misleading: "misleading",
  "partly false": "misleading",
  "partially false": "misleading",
  "mostly false": "misleading",
  "missing context": "misleading",
  "lacks context": "misleading",
  "needs context": "misleading",
  "out of context": "misleading",
  "false context": "misleading",
  distorted: "misleading",
  exaggerated: "misleading",
  exaggeration: "misleading",
  altered: "misleading",
  manipulated: "misleading",
  "edited video": "misleading",
  // Satire circulated as real news misleads the reader.
  satire: "misleading",
  // true
  true: "true",
  correct: "true",
  accurate: "true",
  "mostly true": "true",
  verified: "true",
  genuine: "true",
  // mixed
  "half true": "mixed",
  "partly true": "mixed",
  "partially true": "mixed",
  mixture: "mixed",
  mixed: "mixed",
};

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapRating(rating: string): RatingBucket {
  const whole = normalise(rating);
  if (whole in TABLE) return TABLE[whole]!;
  // Many ratings are sentences ("False. The video is from 2019."): look up the lead clause only.
  const lead = normalise(rating.split(/[.:;!—–(,]/)[0] ?? "");
  if (lead in TABLE) return TABLE[lead]!;
  return "unknown";
}
