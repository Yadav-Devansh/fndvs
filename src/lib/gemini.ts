/** Browser helpers for the Gemini image transcription and the evidence report. */
import type { VerificationReport } from "./evidence/types";

async function post(body: unknown) {
  const res = await fetch("/api/public/ai-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data["error"] === "string" ? data["error"] : "The AI service is unavailable right now.",
    );
  }
  return data;
}

/** Reads the claim text out of a screenshot. */
export async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  const data = await post({ action: "extract", image: imageDataUrl });
  return String(data["text"] ?? "");
}

/** Runs every evidence check for the claim on the server. */
export async function runVerification(text: string): Promise<VerificationReport> {
  const res = await fetch("/api/public/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data["error"] === "string" ? data["error"] : "Verification is unavailable right now.");
  }
  return data as unknown as VerificationReport;
}

/** Reads a picked file into a data URL the API can accept. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image file."));
    reader.readAsDataURL(file);
  });
}

/** Small JPEG copy of the screenshot, so the saved report stays inside browser storage. */
export async function shrinkDataUrl(dataUrl: string, maxSide = 900): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return dataUrl;
  }
}
