import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VerificationRecord } from "@/lib/store";

export const SAMPLE_CLAIMS = [
  {
    label: "Shouty forward",
    text: "URGENT!!! FORWARD THIS TO EVERYONE — the government is switching off all SIM cards not linked to Aadhaar by Friday! SHOCKING!",
  },
  {
    label: "Calm policy claim",
    text: "The Reserve Bank of India announced in its monetary policy statement that the repo rate will remain unchanged at 6.5 percent.",
  },
  {
    label: "Health claim",
    text: "According to a statement by the Ministry of Health, drinking hot water every hour cures covid, officials confirmed on 3 March 2025.",
  },
];

export function ClaimInput({
  text,
  onChange,
  records,
}: {
  text: string;
  onChange: (t: string) => void;
  records: VerificationRecord[];
}) {
  return (
    <div className="space-y-3 border-b border-border pb-5">
      <Label htmlFor="claim" className="text-xs text-muted-foreground">Claim to plan checks for</Label>
      <Textarea id="claim" rows={2} className="min-h-20 resize-y bg-card" value={text} onChange={(e) => onChange(e.target.value.slice(0, 5000))} />
      <div className="flex flex-wrap gap-2">
        {SAMPLE_CLAIMS.map((s) => (
          <Button key={s.label} type="button" size="sm" variant="outline" onClick={() => onChange(s.text)}>
            {s.label}
          </Button>
        ))}
        {records.length > 0 && (
          <select
            aria-label="Load a saved claim"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value=""
            onChange={(e) => {
              const r = records.find((x) => x.id === e.target.value);
              if (r) onChange(r.text);
            }}
          >
            <option value="">Load a saved claim…</option>
            {records.slice(0, 20).map((r) => (
              <option key={r.id} value={r.id}>
                {r.text.slice(0, 70)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
