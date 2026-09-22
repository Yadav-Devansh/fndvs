# Image input + Gemini second opinion

Two additions to the verification flow, without touching the existing scoring engine or the AI Search lab.

## 1. Add an image to a claim

On the "Verify a claim" page, next to the text box:

- Upload or drag in a screenshot (WhatsApp chat, news article photo, social post). JPG/PNG/WebP, up to ~8 MB, one image at a time.
- A thumbnail preview with a remove button.
- "Extract text from image" reads the visible text out of the picture and drops it into the claim box, so the user can correct it before running the check.
- If the picture has no readable text, a clear message asks them to type the claim instead.
- The rest of the flow is unchanged: the extracted text runs through the existing eight-aspect check.
- The report page shows the picture used and marks the claim as "text read from an image".

## 2. Gemini second opinion tab

On the report page, the results become two tabs:

- **Rule-based analysis** — exactly what exists today (verdict, confidence, eight aspects, key terms, official sources).
- **Gemini analysis** — a fresh AI read of the same claim: its own verdict (likely true / likely false / unverifiable), a confidence figure, a short reasoning paragraph, the specific red flags or supporting signals it found, and what a reader should check next. Runs on demand with a button, shows a loading state, and is saved with the report so it does not re-run on every visit.

## 3. Final combined verdict

Above the tabs, one prominent verdict panel:

- The rule-based verdict and the Gemini verdict side by side.
- A single headline inference: **Agreement** (both point the same way, higher confidence) or **Disagreement / needs human checking** (they differ, so treat the claim as unresolved and cross-check the listed official sources).
- Short plain-English line explaining why the two can differ: one reads writing style and wording, the other reasons about the substance of the claim.
- The existing "not a substitute for official verification" disclaimer stays.

Note: Gemini has no live internet access here, so its verdict is reasoning-based, not a live fact-check. The panel wording will say so, and the official Indian source list stays the place to confirm anything.

## Technical notes

- New server route `src/routes/api/public/ai-verify.ts` with two actions: `extract` (image → text) and `verify` (claim text → structured verdict). Calls Lovable AI Gateway (`google/gemini-3.8-flash`, multimodal) server-side with `LOVABLE_API_KEY`; the key never reaches the browser. Structured output via a small strict schema (verdict, confidence, reasoning, signals[], nextSteps[]).
- Image is sent as a base64 data URL with the file's real MIME type; nothing is stored server-side.
- `src/lib/store.ts`: `VerificationRecord` gains optional `imageDataUrl`, `fromImage`, and `geminiVerdict` fields, plus an `updateRecord` helper so the Gemini result can be attached later. Existing records keep working (fields optional).
- `src/routes/submit.tsx`: upload control + extract button, existing validation and error paths untouched.
- `src/routes/result.$submissionId.tsx`: combined verdict panel, shadcn `Tabs` for the two analyses, image display.
- Gateway failures (rate limit, credits, refusal) surface as a readable message in the Gemini tab; the rule-based report always still works.
- Help page gets a short paragraph on both features for the presentation.
