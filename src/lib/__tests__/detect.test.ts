import { describe, expect, it } from "vitest";
import { analyze } from "../detect";
import { findBodies, findDates } from "../detect/signals";
import { tokenize, findTerms } from "../detect/tokenize";
import { topicHitCounts } from "../sources";

const CASH = "The government has quietly decided to ban all cash transactions above Rs 2000 from next month, as per the Ministry of Finance.";
const HOT = "According to a statement by the Ministry of Health, drinking hot water every hour cures covid, officials confirmed on 3 March 2025.";
const PIB = "PIB Fact Check: the claim that new 2000 rupee notes carry a GPS chip is fake news.";
const TRAP = "The whole market may decide to separate the novel database from the forward plan.";

describe("regression", () => {
  it("cash-ban sentence is unverified", () => expect(analyze(CASH).verdict).toBe("unverified"));
  it("hot-water sentence is unverified", () => expect(analyze(HOT).verdict).toBe("unverified"));
  it("PIB debunk sets debunkFraming", () => expect(analyze(PIB).debunkFraming).toBe(true));
  it("substring trap has no dates and no named bodies", () => {
    const r = analyze(TRAP);
    expect(r.dates).toEqual([]);
    expect(r.namedBodies).toEqual([]);
  });
});

describe("word-boundary matching", () => {
  it.each([["whole whose", "who"], ["database", "data"], ["forward warning", "war"], ["secure", "cure"]])(
    "%s does not match %s", (text, term) => expect(findTerms(tokenize(text), [term])).toEqual([]));
  it("WHO counts only in capitals", () => {
    expect(findBodies(tokenize("who said it"), "who said it")).toEqual([]);
    expect(findBodies(tokenize("WHO said it"), "WHO said it").map((b) => b.name)).toEqual(["WHO"]);
    expect(topicHitCounts(tokenize("whole market data app"), "whole market data app")).toEqual({});
  });
  it("month words need a day or year neighbour", () => {
    expect(findDates(tokenize("market may decided separate novel"))).toEqual([]);
    expect(findDates(tokenize("on 12 March"))).toEqual(["12 march"]);
    expect(findDates(tokenize("March 2025"))).toEqual(["march 2025"]);
    expect(findDates(tokenize("May 5"))).toEqual(["may 5"]);
  });
});

describe("engine limits", () => {
  it("non-English text gives unknown risk", () => {
    const r = analyze("सरकार ने सभी नकद लेनदेन पर प्रतिबंध लगाने का फैसला किया है");
    expect(r.language).toBe("non-english");
    expect(r.languageRisk).toBe("unknown");
  });
  it("hoax with forwarding pressure is likely-misleading", () =>
    expect(analyze("Shocking secret cure doctors hate, share before it gets deleted!").verdict).toBe("likely-misleading"));
  it("debunk text does not count 'claims'/'viral' as sensational", () => {
    const r = analyze("Fact check: viral claims about free laptops are a hoax.");
    expect(r.aspects.find((a) => a.id === "sensational")?.evidence).toEqual([]);
  });
});
