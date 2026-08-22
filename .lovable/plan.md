# Simplify the AI Search lab for presentation

The page currently shows everything at once: controls, weights, graph, path, trace, comparison table, heuristic table. That's hard to narrate. The fix is to cut it to one clear story and hide the rest behind an "Advanced" toggle.

## The story the page should tell

"Given a claim, which verification checks should we do, and in what order, to reach a confident verdict fastest?"

Show that with **two algorithms only**:
- **BFS (uninformed)** — tries checks blindly, explores a lot.
- **A* (informed)** — uses the heuristic (how concerning + how cheap each check is) and reaches the goal with fewer expansions and lower cost.

That contrast is the whole point of the lab and is easy to say in one sentence. Best First and Hill Climbing stay in the code and move behind Advanced mode.

## New page layout (top to bottom)

1. **Claim input** — textarea + "Load from history" + Run button. One line explaining the goal.
2. **Result strip** — two cards side by side, BFS vs A*, each showing: states explored, path length, total cost, runtime. A short verdict line underneath, e.g. "A* reached the same goal exploring 9 fewer states."
3. **Graph** — one graph, defaults to A*'s path, with a small BFS / A* switch above it. Filters and collapse controls move into a collapsed "Layout options" row.
4. **Chosen path** — the ordered list of checks with action labels and cost, plus the Animate button. This is the part that reads like a human explanation.
5. **Node inspector** — unchanged, shown only when a node is selected.
6. **Advanced (collapsed by default)** — limits, heuristic weight sliders, step-by-step trace, all-four comparison table, heuristic breakdown table.

## De-cluttering rules applied

- No number appears without a unit or a one-line caption saying what it means.
- Heuristic weights get sensible defaults and stay hidden unless opened.
- Graph node labels keep the code (S0, S3) plus a short name; the path index badge stays.
- Section count on first screen drops from 6 to 3.

## Technical notes

- Only `src/routes/ai-search.tsx` changes (layout, local state for `mode: 'simple' | 'advanced'` and `graphAlgo: 'bfs' | 'astar'`).
- No changes to `src/lib/ai/*` — all four algorithms keep working; `runAll` still powers the advanced comparison table.
- `StateGraph.tsx` unchanged; its filter/collapse props get driven from the collapsed "Layout options" row.
- Help page: trim the AI section to a 4-step demo script matching the new layout.
