# evidence/ - Gemini gateway + (unused in UI) evidence checks
- gateway.server.ts: calls Gemini through the Lovable AI Gateway with retries; runOpinion() gives the independent Gemini verdict.
- factcheck.ts, news.ts, decide.ts, report.server.ts: fact-check/news pipeline kept for /api/public/verify but not called from the UI.
