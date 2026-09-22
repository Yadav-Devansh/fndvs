/**
 * Local demonstration store.
 *
 * The public demo has no sign-in, so verification records live in the visitor's
 * own browser (localStorage). Nothing leaves the device. Swap this module for a
 * database-backed API when accounts are reintroduced.
 */

import { predict, type PredictionResult } from "./predict";
import type { GeminiVerdict } from "./gemini";

export interface VerificationRecord {
  id: string;
  text: string;
  submittedAt: string;
  result: PredictionResult;
  /** Screenshot the claim text was read from, if any. */
  imageDataUrl?: string;
  /** True when the claim text came from an uploaded image. */
  fromImage?: boolean;
  /** Cached Gemini second opinion, attached after the report is opened. */
  geminiVerdict?: GeminiVerdict;
}

const KEY = "fndvs.records.v2";

const SEED_TEXTS = [
  "SHOCKING: Doctors hate this miracle cure that reverses diabetes overnight! Share before it is deleted from the internet forever!!!",
  "According to a statement issued by the Ministry of Health and Family Welfare on 12 March 2025, the national measles-rubella campaign has reached 94 percent coverage across 28 states.",
  "Leaked documents allegedly expose a secret plan by officials to ban all cash transactions from next month, sources claim.",
  "The Reserve Bank of India announced in its monetary policy statement that the repo rate will remain unchanged at 6.5 percent, citing inflation data published by MoSPI.",
  "URGENT: Forward this to 10 people immediately — the government is switching off all mobile SIM cards that are not linked to Aadhaar by Friday!",
  "ISRO confirmed that the launch window for the next earth-observation satellite opens on 4 April 2025, according to a press release from the space agency.",
  "Unbelievable! A viral video claims the new expressway collapsed within a week, but no evidence has been provided by anonymous accounts sharing it.",
  "The India Meteorological Department issued an orange alert for coastal districts, forecasting rainfall of 115 mm over the next 24 hours.",
];

function makeSeed(): VerificationRecord[] {
  const now = Date.now();
  return SEED_TEXTS.map((text, i) => ({
    id: `demo-${i + 1}`,
    text,
    submittedAt: new Date(now - (i + 1) * 7.5 * 3600 * 1000).toISOString(),
    result: predict(text),
  }));
}

function read(): VerificationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const seeded = makeSeed();
      window.localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as VerificationRecord[];
  } catch {
    return [];
  }
}

function write(records: VerificationRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(records.slice(0, 200)));
  window.dispatchEvent(new Event("fndvs:records"));
}

export function listRecords(): VerificationRecord[] {
  return read().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function getRecord(id: string): VerificationRecord | undefined {
  return read().find((r) => r.id === id);
}

export function addRecord(
  text: string,
  result: PredictionResult,
  extra?: Pick<VerificationRecord, "imageDataUrl" | "fromImage">,
): VerificationRecord {
  const record: VerificationRecord = {
    id: `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    submittedAt: new Date().toISOString(),
    result,
    ...(extra ?? {}),
  };
  write([record, ...read()]);
  return record;
}

/** Merges fields into a stored record (used to cache the Gemini verdict). */
export function updateRecord(
  id: string,
  patch: Partial<Omit<VerificationRecord, "id">>,
): VerificationRecord | undefined {
  const records = read();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return undefined;
  const updated = { ...records[index]!, ...patch };
  records[index] = updated;
  write(records);
  return updated;
}

export function clearRecords() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("fndvs:records"));
}
