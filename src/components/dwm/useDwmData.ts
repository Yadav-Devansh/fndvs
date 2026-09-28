import { useCallback, useEffect, useState } from "react";
import { loadBundled, loadStoredAggregates } from "@/lib/dwm/idb";
import type { DwmAggregates } from "@/lib/dwm/types";

export type DwmSource = "saved" | "bundled" | null;

/** Load order: IndexedDB → bundled public/data JSON → empty. */
export function useDwmData() {
  const [agg, setAgg] = useState<DwmAggregates | null>(null);
  const [source, setSource] = useState<DwmSource>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    let a: DwmAggregates | undefined | null = null;
    try {
      a = await loadStoredAggregates();
    } catch {
      setStorageError(true);
    }
    if (a) { setAgg(a); setSource("saved"); setLoading(false); return; }
    const b = await loadBundled();
    setAgg(b);
    setSource(b ? "bundled" : null);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { agg, source, loading, storageError, reload };
}
