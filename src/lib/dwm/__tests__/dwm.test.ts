import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { predict } from "../../predict";
import { Aggregator, parseDate, normaliseCategory, cleanText, windowStartFor } from "../pipeline";
import { rollUp } from "../analytics";
import { generateDemo } from "../demo";
import { apriori } from "../apriori";
import snapshot from "./scorer-snapshot.json";

const HEADLINES = Array.from({ length: 200 }, (_, i) =>
  [
    `Mumbai civic body announces water cut in ${i} wards`,
    `SHOCKING secret cure doctors hate ${i}, share before deleted!`,
    `RBI keeps repo rate unchanged at ${i % 7} percent according to officials`,
    `You won't believe what happened next in match ${i}`,
  ][i % 4]!,
);

describe("scorer regression", () => {
  it("200 fixed headlines score exactly as the stored snapshot", () => {
    const now = HEADLINES.map((h) => { const r = predict(h); return [r.label, r.confidenceScore, r.aspects.map((a) => a.score)]; });
    expect(now).toEqual(snapshot);
  });
});

describe("pipeline", () => {
  it("parses dates", () => {
    expect(parseDate("20190105", "YYYYMMDD")).toBe(20190105);
    expect(parseDate("05/01/2019", "DD/MM/YYYY")).toBe(20190105);
    expect(parseDate("Jan 5, 2019", "MONTH DD, YYYY")).toBe(20190105);
    expect(parseDate("garbage", "YYYYMMDD")).toBeNull();
  });
  it("normalises categories and text", () => {
    expect(normaliseCategory("city.mumbai")).toBe("City");
    expect(normaliseCategory("unknown")).toBe("Other");
    expect(cleanText("  <b>Hi</b> &amp;  there ")).toBe("Hi & there");
    expect(windowStartFor(20200630, 5)).toBe(20150701);
  });
  it("drops bad rows and cube roll-up equals rows scored", () => {
    const csv = readFileSync(new URL("../../../../scripts/fixtures/tiny-headlines.csv", import.meta.url), "utf8").trim().split("\n").slice(1);
    const agg = new Aggregator({ datasetId: "t", datasetName: "t", source: "t", isSynthetic: false, windowStartYmd: 20170701, windowEndYmd: 20200630, windowYears: 3, sampleSize: 100, processingMode: "test" });
    for (const line of csv) {
      const [d, c, ...t] = line.split(",");
      agg.add(parseDate(d ?? "", "YYYYMMDD"), c ?? "", t.join(",").replace(/^"|"$/g, ""));
    }
    const out = agg.finalize();
    expect(out.meta.dropped).toMatchObject({ duplicate: 1, badDate: 1, outOfWindow: 1, empty: 1 });
    expect(rollUp(out.cube, "all")[0]?.total).toBe(out.meta.rowsScored);
  });
  it("demo roll-ups are exact at every grain", () => {
    const d = generateDemo(5, 3000);
    const total = d.meta.rowsScored;
    for (const g of ["month", "quarter", "year", "category", "all"] as const)
      expect(rollUp(d.cube, g).reduce((a, r) => a + r.total, 0)).toBe(total);
    expect(d.meta.isSynthetic).toBe(true);
  });
  it("apriori finds a simple rule", () => {
    const tx = Array.from({ length: 100 }, (_, i) => (i < 60 ? ["a", "b"] : ["c"]));
    const r = apriori(tx, 0.1, 0.5);
    expect(r.some((x) => x.antecedent[0] === "a" && x.consequent === "b" && x.confidence === 1)).toBe(true);
  });
});
