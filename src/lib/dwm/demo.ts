/**
 * SYNTHETIC DEMO DATA generator. Produces template headlines so every chart
 * can be demonstrated before the real dataset is loaded. Never real news.
 */

import { Aggregator, rng } from "./pipeline";
import type { DwmAggregates } from "./types";

const NEUTRAL = [
  "{city} civic body announces new water supply schedule for {n} wards",
  "{org} releases quarterly report on {topic} according to officials",
  "{city} police arrest {n} in connection with theft case",
  "State ministry confirms {n} new schools for {city} district",
  "{team} beat rivals by {n} runs in league match",
  "{org} spokesperson said the {topic} review will finish in March",
  "Film on {topic} crosses {n} crore at box office",
];
const RISKY = [
  "SHOCKING secret about {topic} they don't want you to know, share before deleted!",
  "You won't believe what {city} doctors hate about this miracle cure",
  "Viral forward claims {org} secretly banned {topic}, forward this now",
  "Hidden truth exposed: {topic} hoax spreads in {city}, act now!!",
  "Unbelievable leaked rumours about {team} - must read before it's deleted",
];
const CITY = ["Mumbai", "Delhi", "Pune", "Kolkata", "Chennai", "Lucknow", "Jaipur"];
const ORG = ["RBI", "ISRO", "ICMR", "NITI Aayog", "the Election Commission"];
const TOPIC = ["vaccines", "fuel prices", "exam results", "bank notes", "monsoon", "5G towers"];
const TEAM = ["Mumbai Indians", "India", "Chennai Super Kings"];
const CATS: [string, number][] = [
  ["city.mumbai", 0.08], ["india", 0.12], ["sports.cricket", 0.03], ["business.india-business", 0.05],
  ["entertainment.hindi", 0.1], ["world", 0.06], ["tech", 0.09], ["education", 0.04], ["life-style", 0.07],
];

export function generateDemo(years = 5, count = 30000): DwmAggregates {
  const rand = rng(2026);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;
  const endYear = 2020;
  const endYmd = endYear * 10000 + 630;
  const startYmd = (endYear - years) * 10000 + 701;
  const agg = new Aggregator({
    datasetId: "synthetic-demo",
    datasetName: "SYNTHETIC DEMO DATA",
    source: "Generated locally from templates. Not real news.",
    isSynthetic: true,
    windowStartYmd: startYmd,
    windowEndYmd: endYmd,
    windowYears: years,
    sampleSize: 10000,
    processingMode: "Synthetic demo generator",
  });
  const months = years * 12;
  for (let i = 0; i < count; i++) {
    const mi = Math.floor(rand() * months);
    const y = endYear - years + Math.floor((6 + mi) / 12);
    const m = ((6 + mi) % 12) + 1;
    const d = 1 + Math.floor(rand() * 28);
    const [cat, base] = pick(CATS);
    const seasonal = m === 3 || m === 11 ? 0.06 : 0;
    const drift = (mi / months) * 0.05;
    const tpl = rand() < base + seasonal + drift ? pick(RISKY) : pick(NEUTRAL);
    const text = tpl
      .replace("{city}", pick(CITY)).replace("{org}", pick(ORG)).replace("{topic}", pick(TOPIC))
      .replace("{team}", pick(TEAM)).replace("{n}", String(2 + Math.floor(rand() * 90))) + ` #${i}`;
    agg.add(y * 10000 + m * 100 + d, cat, text);
  }
  return agg.finalize();
}
