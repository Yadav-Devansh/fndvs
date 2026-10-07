import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clientIp, json, jsonError, limited, rateLimit, readJson } from "@/lib/api-guard.server";
import { buildReport } from "@/lib/evidence/report.server";
import { MAX_TEXT, MIN_TEXT } from "@/lib/predict";

/**
 * POST /api/public/verify  { text } -> VerificationReport
 * Runs the fact-check lookup, news corroboration and grounded Gemini, then decide().
 * Logged: upstream status codes only. Claim text is never logged or stored.
 */
const Body = z.object({ text: z.string().trim().min(MIN_TEXT).max(MAX_TEXT) });

export const Route = createFileRoute("/api/public/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = rateLimit(`verify:${clientIp(request)}`, 10);
        if (!rl.ok) return limited(rl.retryAfter);
        const read = await readJson(request);
        if (!read.ok) return read.res;
        const parsed = Body.safeParse(read.body);
        if (!parsed.success) {
          return jsonError(400, `\`text\` must be between ${MIN_TEXT} and ${MAX_TEXT} characters.`);
        }
        try {
          return json(await buildReport(parsed.data.text));
        } catch {
          return jsonError(500, "Verification failed — please try again.");
        }
      },
    },
  },
});
