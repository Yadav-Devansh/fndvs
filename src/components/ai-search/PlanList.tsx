import { orderPlan, type PlanResult, type Problem } from "@/lib/planner";

export function PlanList({ problem, result }: { problem: Problem; result: PlanResult }) {
  const order = orderPlan(problem, result.plan);
  let running = 0;
  return (
    <div className="surface p-6">
      <h2 className="eyebrow">A* plan — run these checks in this order</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Goal: evidence ≥ {problem.threshold.toFixed(2)} ({Math.round(problem.tau * 100)}% of {problem.total.toFixed(2)} available).
        Cheapest gain-per-cost first, so you can stop early.
      </p>
      <ol className="mt-4 space-y-2">
        {order.map((i, n) => {
          const c = problem.checks[i]!;
          running += c.gain;
          return (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border bg-background p-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{n + 1}.</span>
              <span className="font-semibold">{c.label}</span>
              <span className="text-muted-foreground">cost {c.cost}</span>
              <span className="text-muted-foreground">
                gain {c.gain.toFixed(2)}{c.estimated ? " (estimate)" : ""}
              </span>
              <span className="text-muted-foreground">cost/gain {(c.cost / c.gain).toFixed(2)}</span>
              <span className="ml-auto text-xs text-muted-foreground">evidence so far {running.toFixed(2)}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm">
        Total cost <strong>{result.cost}</strong> for {result.plan.length} of {problem.checks.length} checks, versus{" "}
        {problem.checks.reduce((s, c) => s + c.cost, 0)} for running everything.
      </p>
    </div>
  );
}
