import { createFileRoute } from "@tanstack/react-router";
import { MIN_TEXT, MAX_TEXT } from "@/lib/predict";
import type { GeminiVerdict } from "@/lib/gemini";

/**
 * POST /api/public/ai-verify
 *
 * Two actions, both backed by Lovable AI (Gemini, multimodal):
 *   { action: "extract", image: "data:image/png;base64,..." }
 *     -> { text: string }
 *   { action: "verify", text: "..." }
 *     -> { verdict, confidence, reasoning, signals[], nextSteps[] }
 *
 * Public + stateless: nothing is stored. The API key stays server-side.
 */

const MODEL = "google/gemini-3.8-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp"];


export const Route = createFileRoute("/api/public/ai-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return json({ error: "AI analysis is not configured." }, 500);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const action = body["action"];

        if (action === "extract") {
          const image = body["image"];
          if (typeof image !== "string" || !image.startsWith("data:")) {
            return json({ error: "`image` must be a data URL" }, 400);
          }
          const mime = image.slice(5, image.indexOf(";")).toLowerCase();
          if (!ALLOWED_MIME.includes(mime)) {
            return json({ error: "Please upload a PNG, JPG or WebP image." }, 400);
          }
          const base64 = image.slice(image.indexOf(",") + 1);
          if (Math.floor(base64.length * 0.75) > MAX_IMAGE_BYTES) {
            return json({ error: "That image is larger than 8 MB." }, 400);
          }
          return runExtract(key, image);
        }

        if (action === "verify") {
          const text = body["text"];
          if (typeof text !== "string") {
            return json({ error: "`text` must be a string" }, 400);
          }
          const trimmed = text.trim();
          if (trimmed.length < MIN_TEXT || trimmed.length > MAX_TEXT) {
            return json(
              { error: `\`text\` must be between ${MIN_TEXT} and ${MAX_TEXT} characters` },
              400,
            );
          }
          return runVerify(key, trimmed);
        }

        return json({ error: "`action` must be \"extract\" or \"verify\"" }, 400);
      },
    },
  },
});

/** Only rate limits and upstream faults are worth retrying. */
const RETRYABLE = (status: number) => status === 429 || status >= 500;

async function callGateway(key: string, messages: unknown[], jsonMode: boolean) {
  const body = JSON.stringify({
    model: MODEL,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  let last = { ok: false as const, status: 502, detail: "" };

  // Up to three attempts with backoff: the model provider occasionally answers
  // 503 ("upstream_error") on an otherwise valid request.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));

    let res: Response;
    try {
      res = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body,
      });
    } catch (e) {
      last = { ok: false as const, status: 503, detail: String(e).slice(0, 300) };
      continue;
    }

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string } }[];
      };
      return { ok: true as const, content: data.choices?.[0]?.message?.content ?? "" };
    }

    const detail = await res.text().catch(() => "");
    last = { ok: false as const, status: res.status, detail };
    if (!RETRYABLE(res.status)) break;
  }

  return last;
}

function gatewayError(status: number, detail: string) {
  if (status === 402) {
    return json(
      { error: "The AI workspace is out of credits — add credits to run Gemini analysis." },
      402,
    );
  }
  if (status === 429) {
    return json({ error: "Too many AI requests right now — try again in a moment." }, 429);
  }
  if (status === 403) {
    return json({ error: "Gemini analysis is not available for this workspace." }, 403);
  }
  console.error("ai-verify gateway error", status, detail.slice(0, 500));
  return json(
    {
      error:
        "The AI service is busy right now and didn't answer — please press the button again in a few seconds.",
    },
    503,
  );
}

async function runExtract(key: string, image: string) {
  const result = await callGateway(
    key,
    [
      {
        role: "system",
        content:
          "You transcribe text from screenshots of news articles, social posts and chat messages. " +
          "Return ONLY the news claim or message text, verbatim where possible, with no commentary, " +
          "no quotation marks and no labels. Ignore interface chrome such as timestamps, battery icons, " +
          "sender names and button labels. If the image contains no readable claim text, return exactly: NO_TEXT",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe the news claim or message shown in this image." },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    false,
  );

  if (!result.ok) return gatewayError(result.status, result.detail);

  const text = result.content.trim();
  if (!text || text === "NO_TEXT" || text.length < MIN_TEXT) {
    return json(
      {
        error:
          "No readable claim text was found in that image. Please type or paste the claim instead.",
      },
      422,
    );
  }
  return json({ text: text.slice(0, MAX_TEXT) }, 200);
}

async function runVerify(key: string, text: string) {
  const result = await callGateway(
    key,
    [
      {
        role: "system",
        content:
          "You are a careful fact-checking analyst for an Indian news verification tool. " +
          "You have NO live internet access, so judge plausibility from the substance of the claim, " +
          "internal consistency, how verifiable it is, and your general knowledge — never invent sources. " +
          'Reply with JSON only, shaped: {"verdict":"likely-true"|"likely-false"|"unverifiable",' +
          '"confidence":0-100,"reasoning":"2-4 sentences","signals":["short findings"],' +
          '"nextSteps":["what a reader should check"]}. ' +
          "Keep signals and nextSteps to at most 5 short items each.",
      },
      { role: "user", content: `Assess this claim:\n\n${text}` },
    ],
    true,
  );

  if (!result.ok) return gatewayError(result.status, result.detail);

  const parsed = parseVerdict(result.content);
  if (!parsed) return json({ error: "Gemini returned an unreadable answer — try again." }, 502);
  return json(parsed, 200);
}

function parseVerdict(raw: string): GeminiVerdict | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const verdictRaw = String(obj["verdict"] ?? "").toLowerCase();
  const verdict: GeminiVerdict["verdict"] = verdictRaw.includes("true")
    ? "likely-true"
    : verdictRaw.includes("false")
      ? "likely-false"
      : "unverifiable";

  const confidenceNum = Number(obj["confidence"]);
  const reasoning = typeof obj["reasoning"] === "string" ? obj["reasoning"].trim() : "";
  if (!reasoning) return null;

  return {
    verdict,
    confidence: Number.isFinite(confidenceNum)
      ? Math.min(100, Math.max(0, Math.round(confidenceNum)))
      : 50,
    reasoning: reasoning.slice(0, 1200),
    signals: toList(obj["signals"]),
    nextSteps: toList(obj["nextSteps"]),
  };
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, 5);
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
