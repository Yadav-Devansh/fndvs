const ROWS: [string, string][] = [
  ["Problem", "Find the cheapest set and order of checks that gathers enough evidence to be confident, then stop."],
  ["State", "The set of checks already done (11 checks → 2¹¹ = 2048 states). Start: the empty set."],
  ["Action", "Run one check not yet done: S → S ∪ {c}."],
  ["Step cost", "Local language check 1 · official-source lookup 1 · fact-check 2 · news 3 · Gemini 4."],
  ["Gain", "Local: |score − 50| / 50 from the real result. Fact-check, news, Gemini: labelled estimates."],
  ["Goal test", "E(S) = Σ gains ≥ T, where T = τ × (all gains), τ = 0.6 by default."],
  ["Heuristic h(S)", "Fractional knapsack: cover T − E(S) with the cheapest cost-per-gain checks, allowing a fraction of the last."],
  ["Admissible", "Allowing fractions can only make the cover cheaper, so h never overestimates — and it is consistent, so A* is optimal."],
];

export function HowItWorks() {
  return (
    <div className="surface p-6">
      <h2 className="eyebrow">How it works</h2>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {ROWS.map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <th scope="row" className="w-36 py-2 pr-3 text-left align-top font-semibold">{k}</th>
              <td className="py-2 text-muted-foreground">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        The planner decides how to check a claim, not whether it is true.
      </p>
    </div>
  );
}
