/**
 * Reputable-outlet allow-list for news corroboration. A domain matches itself
 * and its subdomains. Keep this list editorially reviewed and short.
 */
export const REPUTABLE_OUTLETS: readonly string[] = [
  "thehindu.com",
  "indianexpress.com",
  "hindustantimes.com",
  "timesofindia.indiatimes.com",
  "economictimes.indiatimes.com",
  "ndtv.com",
  "livemint.com",
  "business-standard.com",
  "indiatoday.in",
  "deccanherald.com",
  "thehindubusinessline.com",
  "scroll.in",
  "theprint.in",
  "newindianexpress.com",
  "telegraphindia.com",
  "news18.com",
  "moneycontrol.com",
  "pib.gov.in",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "aljazeera.com",
  "theguardian.com",
];

export function normaliseDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").trim();
}

export function isReputable(domain: string): boolean {
  const d = normaliseDomain(domain);
  return REPUTABLE_OUTLETS.some((o) => d === o || d.endsWith(`.${o}`));
}
