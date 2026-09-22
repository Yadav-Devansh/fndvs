import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, AlertTriangle, ShieldCheck, ImagePlus, ScanText, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Disclaimer } from "@/components/PredictionUI";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MIN_TEXT, MAX_TEXT, type PredictionResult } from "@/lib/predict";
import { addRecord } from "@/lib/store";
import { extractTextFromImage, fileToDataUrl, shrinkDataUrl } from "@/lib/gemini";

export const Route = createFileRoute("/submit")({
  component: SubmitPage,
  head: () => ({
    meta: [
      { title: "Verify a claim — FNDVS" },
      {
        name: "description",
        content:
          "Paste a headline, forwarded message or article and get an eight-point credibility analysis plus the official Indian source to cross-check it against.",
      },
      { property: "og:title", content: "Verify a claim — FNDVS" },
      {
        property: "og:description",
        content: "Eight-point credibility analysis with official source corroboration.",
      },
    ],
  }),
});

const SAMPLES = [
  "SHOCKING!! Doctors hate this miracle cure — share before it is deleted!!! Big pharma does not want you to know the hidden truth.",
  "According to a press release from the Ministry of Railways dated 4 March 2025, the new 62 km suburban line will open for service after a safety inspection by the Commissioner of Railway Safety.",
];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

function SubmitPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [forceError, setForceError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  const lengthValid = trimmed.length >= MIN_TEXT && trimmed.length <= MAX_TEXT;

  const acceptFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is larger than 8 MB — please use a smaller screenshot.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageName(file.name);
      setExtracted(false);
    } catch {
      setError("Could not read that image file.");
    }
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setImageName(null);
    setExtracted(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onExtract = async () => {
    if (!imageDataUrl) return;
    setError(null);
    setExtracting(true);
    try {
      const found = await extractTextFromImage(imageDataUrl);
      setText(found.slice(0, MAX_TEXT));
      setExtracted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read text from that image.");
    } finally {
      setExtracting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!lengthValid) {
      setError(`Please enter between ${MIN_TEXT} and ${MAX_TEXT.toLocaleString()} characters.`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/public/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed, forceError }),
      });
      if (!response.ok) throw new Error("prediction-failed");
      const result = (await response.json()) as PredictionResult;
      const thumbnail = imageDataUrl ? await shrinkDataUrl(imageDataUrl) : undefined;
      const record = addRecord(trimmed, result, {
        ...(thumbnail ? { imageDataUrl: thumbnail } : {}),
        ...(extracted ? { fromImage: true } : {}),
      });
      void navigate({ to: "/result/$submissionId", params: { submissionId: record.id } });
    } catch {
      setError("The analysis service is unavailable right now — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Verification desk"
          title="Verify a claim"
          description="Paste the headline, forwarded message or article you want checked. English text only, between 20 and 5,000 characters. Nothing is uploaded to an account — your record stays in this browser."
        />

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="news-text">News text, forwarded message or claim</Label>
            <Textarea
              id="news-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
              rows={12}
              placeholder="e.g. The Ministry of Road Transport confirmed on 12 May 2025 that the new licence rules take effect from June…"
              className="resize-y text-base"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span
                className={
                  trimmed.length > 0 && !lengthValid
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                }
              >
                {trimmed.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} characters
                {trimmed.length < MIN_TEXT && trimmed.length > 0
                  ? ` — ${MIN_TEXT - trimmed.length} more needed`
                  : ""}
              </span>
              <span className="flex gap-2">
                {SAMPLES.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setText(s)}
                    className="rounded border border-border px-2 py-1 font-medium text-muted-foreground hover:bg-accent"
                  >
                    Load sample {i + 1}
                  </button>
                ))}
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-fake-soft p-4 text-sm font-medium text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
            <div>
              <Label htmlFor="force-error" className="text-sm">
                Simulate analysis-service failure
              </Label>
              <p className="text-xs text-muted-foreground">
                Demonstration toggle for the service-unavailable error path.
              </p>
            </div>
            <Switch id="force-error" checked={forceError} onCheckedChange={setForceError} />
          </div>

          <Button type="submit" size="lg" disabled={!lengthValid || busy} className="w-full sm:w-auto">
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Analysing…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 size-4" aria-hidden="true" /> Run verification
              </>
            )}
          </Button>

          <Disclaimer />
        </form>
      </div>
    </AppShell>
  );
}
