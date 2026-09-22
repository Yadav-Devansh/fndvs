/** Shared types + browser helpers for the Gemini second-opinion analysis. */

export type GeminiVerdictLabel = "likely-true" | "likely-false" | "unverifiable";

export interface GeminiVerdict {
  verdict: GeminiVerdictLabel;
  confidence: number;
  reasoning: string;
  signals: string[];
  nextSteps: string[];
}

export const GEMINI_VERDICT_TEXT: Record<GeminiVerdictLabel, string> = {
  "likely-true": "Likely true",
  "likely-false": "Likely false",
  unverifiable: "Cannot be verified",
};

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

/** Asks Gemini for an independent read of the claim. */
export async function runGeminiVerify(text: string): Promise<GeminiVerdict> {
  return (await post({ action: "verify", text })) as unknown as GeminiVerdict;
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
