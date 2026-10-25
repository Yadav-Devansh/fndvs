# detect/ - Rule engine (wording & tone)
Reads HOW a claim is written, not whether it is true.
- tokenize.ts: whole-word tokens so 'who' never matches 'whole'.
- lexicon.ts: weighted word lists (sensational, urgency, forwarding, debunk markers...).
- signals.ts: one pure function per signal.
- index.ts: analyze() combines signals into a 0-100 risk score and a cautious verdict (unverified / likely-misleading; never 'credible').
Tested in src/lib/__tests__/detect.test.ts and pinned by the predict snapshot.
