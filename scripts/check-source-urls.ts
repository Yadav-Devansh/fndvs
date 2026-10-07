/** HEAD-checks every URL in src/lib/sources.ts and prints failures. Never edits URLs. Run: bun scripts/check-source-urls.ts */
import { OFFICIAL_SOURCES } from "../src/lib/sources";

let failures = 0;
await Promise.all(OFFICIAL_SOURCES.map(async (s) => {
  try {
    const res = await fetch(s.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) { failures++; console.log(`FAIL ${res.status}  ${s.shortName}  ${s.url}`); }
  } catch (e) {
    failures++; console.log(`FAIL ${(e as Error).name}  ${s.shortName}  ${s.url}`);
  }
}));
console.log(`\n${OFFICIAL_SOURCES.length - failures}/${OFFICIAL_SOURCES.length} reachable. Some government sites reject HEAD; check failures manually.`);
