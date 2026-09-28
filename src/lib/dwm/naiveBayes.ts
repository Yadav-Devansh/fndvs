/**
 * DWM Concept: Multinomial Naive Bayes text classifier with Laplace smoothing.
 * Trained on labelled data only; an extra technique beside the rule-based scorer.
 */

const STOP = new Set(
  "the a an and or but of to in on for with at by from that this it is are was were be been as has have had will would not no its their they he she we you said".split(" "),
);

export function tokenize(t: string): string[] {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

export interface NBModel {
  classes: string[];
  prior: Record<string, number>;
  wordCounts: Record<string, Map<string, number>>;
  totals: Record<string, number>;
  vocab: Set<string>;
}

export function trainNB(docs: { text: string; label: string }[]): NBModel {
  const classes = [...new Set(docs.map((d) => d.label))];
  const prior: Record<string, number> = {};
  const wordCounts: Record<string, Map<string, number>> = {};
  const totals: Record<string, number> = {};
  const vocab = new Set<string>();
  for (const c of classes) { prior[c] = 0; wordCounts[c] = new Map(); totals[c] = 0; }
  for (const d of docs) {
    prior[d.label] = (prior[d.label] ?? 0) + 1;
    const wc = wordCounts[d.label]!;
    for (const w of tokenize(d.text)) {
      vocab.add(w);
      wc.set(w, (wc.get(w) ?? 0) + 1);
      totals[d.label] = (totals[d.label] ?? 0) + 1;
    }
  }
  for (const c of classes) prior[c] = (prior[c] ?? 0) / docs.length;
  return { classes, prior, wordCounts, totals, vocab };
}

export function predictNB(m: NBModel, text: string): string {
  const words = tokenize(text);
  let best = m.classes[0] ?? "";
  let bestScore = -Infinity;
  const V = m.vocab.size;
  for (const c of m.classes) {
    let s = Math.log(m.prior[c] ?? 1e-9);
    const wc = m.wordCounts[c]!;
    const tot = m.totals[c] ?? 0;
    for (const w of words) s += Math.log(((wc.get(w) ?? 0) + 1) / (tot + V));
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return best;
}
