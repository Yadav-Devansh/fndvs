/** IndexedDB persistence for the (multi-MB) aggregates. */

import type { DwmAggregates } from "./types";

const DB = "fndvs-dwm";
const STORE = "kv";
export const AGG_KEY = "dwm-aggregates-v1";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const saveAggregates = (a: DwmAggregates) => tx<void>("readwrite", (s) => s.put(a, AGG_KEY));
export const loadStoredAggregates = () => tx<DwmAggregates | undefined>("readonly", (s) => s.get(AGG_KEY));
export const clearAggregates = () => tx<void>("readwrite", (s) => s.delete(AGG_KEY));

export function isAggregates(x: unknown): x is DwmAggregates {
  const o = x as DwmAggregates;
  return !!o && typeof o === "object" && !!o.meta && Array.isArray(o.cube) && Array.isArray(o.sample);
}

export async function loadBundled(): Promise<DwmAggregates | null> {
  try {
    const r = await fetch("/data/dwm-aggregates.json");
    if (!r.ok) return null;
    const j: unknown = await r.json();
    return isAggregates(j) ? j : null;
  } catch {
    return null;
  }
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
