import { createFileRoute } from "@tanstack/react-router";
import { predict, MIN_TEXT, MAX_TEXT } from "@/lib/predict";

/**
 * POST /api/public/predict
 * Body: { text: string }
 * 200 -> { label, confidenceScore, explanation[] }
 *
 * MOCK NLP service. Stands in for the Python TF-IDF / Logistic Regression
 * microservice described in the SRS. Public + read-only: it stores nothing and
 * returns no user data.
 */
export const Route = createFileRoute("/api/public/predict")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const text = (body as { text?: unknown })?.text;
        const forceError = (body as { forceError?: unknown })?.forceError === true;

        if (forceError) {
          return json({ error: "Prediction service unavailable" }, 503);
        }

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

        return json(predict(trimmed), 200);
      },
    },
  },
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
