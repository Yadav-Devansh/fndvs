/** Lovable AI Gateway calls for Gemini (image transcription and grounded verification). */
import { jsonError } from "../api-guard.server";
import { GROUNDED_SYSTEM_PROMPT, buildGroundedUserPrompt, parseGrounded } from "./grounded";
import type { EvidenceItem, GeminiLookup } from "./types";

// TODO(owner): verify this model id is still listed by the Lovable AI Gateway.
export const DEFAULT_AI_MODEL = "google/gemini-3.8-flash";
export const DEFAULT_AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Read at call time (env is injected per request); AI_MODEL / AI_GATEWAY_URL override the defaults. */
export const aiModel = () => process.env["AI_MODEL"] || DEFAULT_AI_MODEL;
const gatewayUrl = () => process.env["AI_GATEWAY_URL"] || DEFAULT_AI_GATEWAY_URL;
const RETRYABLE = (status: number) => status === 429 || status >= 500;

export type GatewayResult = { ok: true; content: string } | { ok: false; status: number; detail: string };

export async function callGateway(
  key: string,
  messages: unknown[],
  opts: { jsonMode?: boolean; temperature?: number } = {},
): Promise<GatewayResult> {
  const GATEWAY = gatewayUrl();
  const body = JSON.stringify({
    model: aiModel(),
    messages,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
  });
  let last: GatewayResult = { ok: false, status: 502, detail: "" };
  // Up to three attempts with backoff for transient 429/5xx; other statuses are terminal.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
    let res: Response;
    try {
      res = await fetch(GATEWAY, {
        method: "POST",
        headers: { "content-type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
        body,
      });
    } catch (e) {
      last = { ok: false, status: 503, detail: String(e).slice(0, 200) };
      continue;
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
      return { ok: true, content: data.choices?.[0]?.message?.content ?? "" };
    }
    last = { ok: false, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) };
    if (!RETRYABLE(res.status)) break;
  }
  return last;
}

export function gatewayMessage(status: number): string {
  if (status === 402) return "The AI workspace is out of credits — add credits to run the AI read.";
  if (status === 429) return "Too many AI requests right now — try again in a moment.";
  if (status === 403) return "The AI read is not available for this workspace.";
  return "The AI service is busy right now — please try again in a few seconds.";
}

export function gatewayError(status: number) {
  // Logged: status code only, never claim text.
  if (![402, 403, 429].includes(status)) console.error("ai gateway error", status);
  return jsonError([402, 403, 429].includes(status) ? status : 503, gatewayMessage(status));
}

/** Runs Gemini over the evidence block only, and validates its answer. */
export async function runGrounded(claim: string, items: EvidenceItem[]): Promise<GeminiLookup> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { status: "not-configured", message: "AI read not configured." };
  if (!items.some((i) => i.kind !== "official-source")) {
    return { status: "skipped", message: "Skipped — no fact-checks or news coverage to reason over." };
  }
  const result = await callGateway(
    key,
    [
      { role: "system", content: GROUNDED_SYSTEM_PROMPT },
      { role: "user", content: buildGroundedUserPrompt(claim, items) },
    ],
    { jsonMode: true, temperature: 0.1 },
  );
  if (!result.ok) return { status: "error", message: gatewayMessage(result.status) };
  const parsed = parseGrounded(result.content, items.map((i) => i.id));
  if (!parsed.ok) {
    console.error("grounded answer rejected", parsed.reason.slice(0, 80));
    return { status: "error", message: "The AI answer was rejected because it did not stick to the evidence." };
  }
  return { status: "ok", result: parsed.value };
}
