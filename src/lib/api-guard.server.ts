/**
 * Shared guards for /api/public/* routes: size limits, per-IP rate limiting and
 * consistent JSON errors (never stack traces).
 */

export const MAX_BODY_BYTES = 10 * 1024 * 1024;

export function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export const jsonError = (status: number, error: string, headers?: Record<string, string>) =>
  json({ error }, status, headers);

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/*
 * In-memory fixed-window limiter. On serverless hosting each instance keeps its
 * own counters, so this is per-instance best effort, not a global guarantee.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true };
}

export function limited(retryAfter: number) {
  return jsonError(429, "Too many requests — please wait a minute and try again.", {
    "retry-after": String(retryAfter),
  });
}

/** Reads a JSON body, rejecting anything over MAX_BODY_BYTES. */
export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, res: jsonError(413, "Request body is larger than 10 MB.") };
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, res: jsonError(400, "Could not read the request body.") };
  }
  if (raw.length > MAX_BODY_BYTES) return { ok: false, res: jsonError(413, "Request body is larger than 10 MB.") };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, res: jsonError(400, "Invalid JSON body.") };
  }
}
