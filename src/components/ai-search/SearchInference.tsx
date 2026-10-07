import { useMemo } from "react";
import { evidence, heuristic, type PlanResult, type Problem } from "@/lib/planner";

const fmt = (n: number) => (Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "∞");

/**
 * The Inference tab: a self-contained walk-through of the search. Everything here
 * is computed from the run that is actually displayed — no invented numbers.
 */
export function SearchInference({
  problem,
  result,
  results,
  greedy,
  hill,
}: {
  problem: Problem;
  result: PlanResult;
  results: [PlanResult, PlanResult, PlanResult];
  greedy?: PlanResult;
  hill?: PlanResult;
}) {
  const [bfs, ucs, astar] = results;
  const bothOptimalReached = ucs.goalReached && astar.goalReached;
  const sameCost = Math.abs(ucs.cost - astar.cost) < 1e-6;
  const expansionDifference = ucs.expanded - astar.expanded;

  const checks = result.plan.flatMap((index) => {
    const check = problem.checks[index];
    return check ? [check.label] : [];
  });

  // Worked g / h / f table: replay the selected plan and recompute the values.
  const walk = useMemo(() => {
    const rows: { step: string; label: string; cost: number | null; gain: number; g: number; h: number; f: number }[] = [];
    let mask = 0;
    let g = 0;
    const h0 = heuristic(problem, 0);
    rows.push({ step: "Start", label: "no checks selected", cost: null, gain: evidence(problem, 0), g: 0, h: h0, f: h0 });
    result.plan.forEach((index, i) => {
      const c = problem.checks[index];
      if (!c) return;
      mask |= 1 << index;
      g += c.cost;
      const h = heuristic(problem, mask);
      rows.push({ step: String(i + 1), label: c.label, cost: c.cost, gain: evidence(problem, mask), g, h, f: g + h });
    });
    return rows;
  }, [problem, result]);

  const algos: { r: PlanResult; rule: string; optimises: string; guarantee: string }[] = [
    {
      r: bfs,
      rule: "Queue order: expand the shallowest node first. Cost is never looked at.",
      optimises: "Fewest checks",
      guarantee: "Complete; shortest in number of checks, not in cost.",
    },
    {
      r: ucs,
      rule: "Priority queue on g: always expand the cheapest accumulated cost.",
      optimises: "Total cost",
      guarantee: "Cost-optimal, because every cost is positive.",
    },
    {
      r: astar,
      rule: "Priority queue on f = g + h: cheapest so far plus a safe estimate of what is left.",
      optimises: "Total cost, guided",
      guarantee: "Cost-optimal: h is admissible and consistent.",
    },
  ];
  if (greedy)
    algos.push({
      r: greedy,
      rule: "Priority queue on h only: what is cheapest to finish, ignoring what was already paid.",
      optimises: "Apparent distance to the target",
      guarantee: "No optimality guarantee — it can overpay.",
    });
  if (hill)
    algos.push({
      r: hill,
      rule: "Steepest ascent: take the single remaining check with the best gain ÷ cost.",
      optimises: "Best immediate value per unit cost",
      guarantee: "No backtracking — can stop at a local maximum.",
    });

  return (
    <section className="space-y-8 border-t border-border pt-6" aria-label="Search inference">
      {/* 1 · This run */}
      <div>
        <p className="eyebrow">Inference · {result.name}</p>
        <h2 className="mt-2 text-xl font-semibold">
          {result.goalReached ? "A check plan was found—not a truth verdict" : "No complete plan was found in this search"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {result.goalReached
            ? `${result.name} selected ${result.plan.length} checks with a total model cost of ${result.cost}. Their combined model gain is ${result.evidence.toFixed(2)}, meeting the target of ${problem.threshold.toFixed(2)}. The highlighted path shows how that set of checks was built.`
            : `${result.name}: ${result.note} A missing goal does not mean the claim is false; it means this run did not produce a complete check plan.`}
        </p>
        {checks.length > 0 && (
          <p className="mt-3 break-words text-sm">
            <strong>Highlighted route:</strong> Start with no checks → {checks.join(" → ")}
          </p>
        )}
      </div>

      {/* 2 · Reading the tree */}
      <div className="surface p-6">
        <h3 className="eyebrow">1 · Reading the tree</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The tree is the space of possible <em>plans</em> — every way a set of checks could be assembled. It is not a
          picture of the news, the sources, or the claim's truth.
        </p>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Root (top node)</dt>
            <dd className="text-muted-foreground">The empty set: no checks selected yet. Every search starts here.</dd>
          </div>
          <div>
            <dt className="font-semibold">Node</dt>
            <dd className="text-muted-foreground">One set of checks already chosen. Same set, same node — no article or source lives here.</dd>
          </div>
          <div>
            <dt className="font-semibold">Edge (branch)</dt>
            <dd className="text-muted-foreground">Add one unused check. Its label is the check, its weight is that check's cost.</dd>
          </div>
          <div>
            <dt className="font-semibold">Highlighted path</dt>
            <dd className="text-muted-foreground">The route this algorithm walked to its goal — the proposed plan, in run order.</dd>
          </div>
          <div>
            <dt className="font-semibold">Expanded nodes</dt>
            <dd className="text-muted-foreground">States the algorithm pulled off the frontier and examined. This is the work it did.</dd>
          </div>
          <div>
            <dt className="font-semibold">Frontier nodes</dt>
            <dd className="text-muted-foreground">Generated but not yet examined — still waiting their turn.</dd>
          </div>
          <div>
            <dt className="font-semibold">Pruned nodes</dt>
            <dd className="text-muted-foreground">
              A branch that reaches a set already seen by another route. Different orders, same set — so it is dropped.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Goal</dt>
            <dd className="text-muted-foreground">
              Any node whose collected gain reaches the target {problem.threshold.toFixed(2)} (= τ {fmt(problem.tau)} × all
              available gain {fmt(problem.total)}).
            </dd>
          </div>
        </dl>
      </div>

      {/* 3 · The numbers */}
      <div className="surface p-6">
        <h3 className="eyebrow">2 · The numbers: g, h and f</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Every node carries three planning values. They are arithmetic about effort — never probabilities that a claim
          is true or false.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-semibold">g — cost so far</dt>
            <dd className="text-muted-foreground">
              The sum of the check costs on the path from the root to this node. g at the end of the highlighted path is
              the "Total cost" shown in the comparison.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">h — estimated cost left</dt>
            <dd className="text-muted-foreground">
              A lower bound on what it would still cost to reach the target from here: cover the remaining gain with the
              cheapest gain-per-cost checks, allowing a fraction of the last one. h = 0 means the target is already met.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">f = g + h — estimated total</dt>
            <dd className="text-muted-foreground">
              What this route is expected to cost all together. A* always expands the node with the smallest f, which is
              how it aims at a cheap goal instead of wandering.
            </dd>
          </div>
        </dl>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="mb-2 text-left text-xs text-muted-foreground">
              Recomputed on the highlighted path. Target gain = {problem.threshold.toFixed(2)}.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Step</th>
                <th className="py-2 pr-3 font-medium">Check added</th>
                <th className="py-2 pr-3 text-right font-medium">Cost</th>
                <th className="py-2 pr-3 text-right font-medium">Gain so far</th>
                <th className="py-2 pr-3 text-right font-medium">g</th>
                <th className="py-2 pr-3 text-right font-medium">h</th>
                <th className="py-2 text-right font-medium">f = g + h</th>
              </tr>
            </thead>
            <tbody>
              {walk.map((row) => (
                <tr key={row.step} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{row.step}</td>
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="py-2 pr-3 text-right font-mono">{row.cost ?? "—"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmt(row.gain)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmt(row.g)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmt(row.h)}</td>
                  <td className="py-2 text-right font-mono font-semibold">{fmt(row.f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Read the h column: it falls as cheap, useful checks are taken, and hits 0 exactly when the target is reached.
          That behaviour is the heuristic doing its job.
        </p>
      </div>

      {/* 4 · Cost and what moves it */}
      <div className="surface p-6">
        <h3 className="eyebrow">3 · Cost, and what manipulates it</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Cost is the price of running one check, in abstract effort points standing in for time and API credits. It is a
          modelled assumption chosen by us — not rupees, and not a measured bill.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Check</th>
                <th className="py-2 pr-3 font-medium">Where it runs</th>
                <th className="py-2 pr-3 text-right font-medium">Cost</th>
                <th className="py-2 pr-3 text-right font-medium">Gain</th>
                <th className="py-2 text-right font-medium">Cost per gain</th>
              </tr>
            </thead>
            <tbody>
              {problem.checks.map((c, i) => (
                <tr key={c.id ?? i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">{c.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{c.kind === "local" ? "in this browser" : "external call"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{c.cost}</td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {fmt(c.gain)}
                    {c.estimated ? "*" : ""}
                  </td>
                  <td className="py-2 text-right font-mono">{c.gain > 0 ? fmt(c.cost / c.gain) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          * Estimated gain: external checks cannot be valued before they are run. Local gains come from the wording
          scores of this claim.
        </p>

        <h4 className="mt-6 font-semibold">Four things move cost — and the plan it produces</h4>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">The cost boxes themselves.</strong> Every row above is editable in
            "Advanced → per-check cost overrides". Raise Gemini from 4 to 20 and the planner stops choosing it; drop news
            to 0.5 and it comes in earlier. This is the cleanest thing to change live.
          </li>
          <li>
            <strong className="text-foreground">The τ slider.</strong> It changes no price. It changes how much evidence
            you demand — currently τ {fmt(problem.tau)}, i.e. a target of {problem.threshold.toFixed(2)} gain. A higher τ
            forces more checks, and therefore a higher-cost plan.
          </li>
          <li>
            <strong className="text-foreground">The claim you type.</strong> Costs stay fixed, gains move. Topics
            fact-checkers cover, viral wording, dates and named bodies, and non-English text (news gain halved) all
            change a check's value — so the same prices rank checks differently and give a different plan.
          </li>
          <li>
            <strong className="text-foreground">The algorithm you pick.</strong> BFS ignores cost entirely; UCS and A*
            minimise it; Greedy and Hill Climbing chase gain per cost. Same problem, different cost outcome.
          </li>
        </ol>
      </div>

      {/* 5 · How each algorithm searches */}
      <div className="surface p-6">
        <h3 className="eyebrow">4 · How each algorithm searches this tree</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          All five face the same tree. The only difference is which node they pull next.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Algorithm</th>
                <th className="py-2 pr-3 font-medium">Rule — what it expands next</th>
                <th className="py-2 pr-3 font-medium">Optimises</th>
                <th className="py-2 pr-3 font-medium">Guarantee</th>
                <th className="py-2 text-right font-medium">This run</th>
              </tr>
            </thead>
            <tbody>
              {algos.map(({ r, rule, optimises, guarantee }) => (
                <tr key={r.algorithm} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3 font-semibold">
                    {r.name}
                    {r.algorithm === result.algorithm && <span className="ml-2 text-xs font-normal text-primary">shown</span>}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{rule}</td>
                  <td className="py-2 pr-3">{optimises}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{guarantee}</td>
                  <td className="py-2 text-right font-mono whitespace-nowrap">
                    {r.goalReached ? (
                      <>
                        cost {r.cost} · {r.plan.length} checks · {r.expanded} expanded
                      </>
                    ) : (
                      "no goal"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            {bothOptimalReached
              ? sameCost
                ? `On this claim, A* and UCS reached the target at the same model cost (${astar.cost}). ${
                    expansionDifference > 0
                      ? `A* expanded ${expansionDifference} fewer nodes (${astar.expanded} versus ${ucs.expanded}) — the visible benefit of heuristic guidance.`
                      : expansionDifference < 0
                        ? `A* expanded ${-expansionDifference} more nodes (${astar.expanded} versus ${ucs.expanded}); the heuristic did not cut expansions on this input.`
                        : `Both expanded ${astar.expanded} nodes, so A* did not reduce expansions here.`
                  }`
                : `A* and UCS returned different displayed costs (${astar.cost} and ${ucs.cost}). This run should not be presented as evidence that their costs match.`
              : "A* or UCS did not reach a goal, so this run cannot establish a same-cost comparison."}
          </p>
          <p>
            {bfs.goalReached
              ? `BFS selected ${bfs.plan.length} checks at cost ${bfs.cost}. It minimises the number of checks, not their cost, so it can land on a dearer plan than A* — that gap is the point of an informed search.`
              : "BFS did not reach a goal in this run."}
          </p>
        </div>
      </div>

      {/* 6 · Why A* is trustworthy here */}
      <div className="surface p-6">
        <h3 className="eyebrow">5 · Why the A* result can be trusted</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          h comes from a fractional-knapsack relaxation: cover the remaining gain with the cheapest gain-per-cost checks,
          allowing a fraction of the last one. Letting a check be taken in fractions can only make the cover cheaper or
          equal, so h never overestimates what is really left (admissible); and taking any check whole is one feasible
          relaxed cover, so h(S) ≤ cost(c) + h(S ∪ {c}) (consistent). With positive costs, an admissible and consistent
          h means A* returns a minimum-cost plan whenever the search completes — and it is tested for both properties in
          the project's test suite. The picture illustrates one run; the guarantee comes from those assumptions.
        </p>
      </div>

      {/* 7 · Limits */}
      <div className="border-l-2 border-primary pl-4">
        <h3 className="font-semibold">What it does not prove</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This lab plans checks; it does not execute external fact-check or news lookups. Local gains come from wording
          scores, external gains are estimates, and costs are model units—not measured API bills. Reaching the target
          does not prove a claim true or false, and does not mean independent evidence was collected. The claim report
          separately shows the wording/tone verdict and Gemini's independent opinion; this tree changes neither.
        </p>
      </div>
    </section>
  );
}
