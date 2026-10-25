# api/public/ - server endpoints (no login)
- predict.ts: POST claim -> rule-engine result.
- ai-verify.ts: POST action extract (image->text), opinion (Gemini verdict).
- verify.ts: evidence pipeline (unused by UI).
All use lib/api-guard.server.ts for validation, size and rate limits.
