import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { setLabel, type PlanResult, type Problem } from "@/lib/planner";

export function AdvancedPanel({
  problem,
  tau,
  onTau,
  costs,
  onCost,
  greedy,
  hill,
  trace,
}: {
  problem: Problem;
  tau: number;
  onTau: (t: number) => void;
  costs: Record<string, number>;
  onCost: (id: string, v: number | null) => void;
  greedy: PlanResult;
  hill: PlanResult;
  trace: PlanResult;
}) {
  return (
    <details className="surface p-6">
      <summary className="cursor-pointer text-sm font-semibold">Advanced: τ, costs, Greedy, Hill Climbing and the trace</summary>
      <div className="mt-4 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="tau">Evidence threshold τ = {tau.toFixed(2)}</Label>
          <Slider id="tau" min={0.1} max={1} step={0.05} value={[tau]} onValueChange={(v) => onTau(v[0] ?? tau)} />
        </div>

        <div>
          <p className="text-sm font-semibold">Per-check cost overrides</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {problem.checks.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{c.label}</span>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  className="h-8 w-20"
                  value={costs[c.id] ?? c.cost}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onCost(c.id, Number.isFinite(v) && v > 0 ? v : null);
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[greedy, hill].map((r) => (
            <div key={r.algorithm} className="rounded-lg border border-border p-4 text-sm">
              <p className="font-semibold">{r.name}</p>
              <p className="mt-1">
                {r.goalReached ? `Cost ${r.cost}, ${r.plan.length} checks, ${r.expanded} expanded.` : "No plan found."}
              </p>
              <p className="mt-1 text-muted-foreground">{r.note}</p>
              {r.algorithm === "greedy" && (
                <p className="mt-1 text-xs text-muted-foreground">Greedy follows h only, so it is fast but not guaranteed cheapest.</p>
              )}
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold">Step-by-step trace ({trace.name}, first 60 expansions)</p>
          <ol className="mt-2 max-h-72 space-y-1 overflow-auto font-mono text-xs">
            {trace.steps.slice(0, 60).map((s) => (
              <li key={s.index}>
                {s.index + 1}. {setLabel(problem, s.mask)} — g={s.g} h={s.h} f={Math.round((s.g + s.h) * 100) / 100}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </details>
  );
}
