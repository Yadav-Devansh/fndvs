/**
 * Official-source registry: real Indian government / statutory bodies and their
 * public portals. Submissions are matched to sources by topic keywords only —
 * the ranking is a count of matching keywords, nothing simulated.
 */
import { hasPhrase, phraseIndices, upperTokens } from "./detect/tokenize";

export type Topic =
  | "health"
  | "economy"
  | "policy"
  | "science"
  | "weather"
  | "elections"
  | "digital"
  | "transport"
  | "agriculture"
  | "defence"
  | "general";

export interface OfficialSource {
  id: string;
  name: string;
  shortName: string;
  mandate: string;
  url: string;
  topics: Topic[];
}

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: "pib-factcheck",
    name: "PIB Fact Check — Press Information Bureau",
    shortName: "PIB Fact Check",
    mandate: "Government of India's official rebuttal unit for viral misinformation.",
    url: "https://pib.gov.in/factcheck.aspx",
    topics: ["general", "policy", "health", "economy", "digital", "elections"],
  },
  {
    id: "niti-aayog",
    name: "NITI Aayog",
    shortName: "NITI Aayog",
    mandate: "Public policy think tank; indices, sectoral reports and reform data.",
    url: "https://www.niti.gov.in/",
    topics: ["policy", "economy", "agriculture", "health", "general"],
  },
  {
    id: "mohfw",
    name: "Ministry of Health & Family Welfare",
    shortName: "MoHFW",
    mandate: "Health advisories, disease bulletins and vaccination guidance.",
    url: "https://www.mohfw.gov.in/",
    topics: ["health"],
  },
  {
    id: "icmr",
    name: "Indian Council of Medical Research",
    shortName: "ICMR",
    mandate: "Biomedical research body; clinical guidance and treatment advisories.",
    url: "https://www.icmr.gov.in/",
    topics: ["health", "science"],
  },
  {
    id: "rbi",
    name: "Reserve Bank of India",
    shortName: "RBI",
    mandate: "Currency, banking regulation, monetary policy statements.",
    url: "https://www.rbi.org.in/",
    topics: ["economy", "digital"],
  },
  {
    id: "mospi",
    name: "Ministry of Statistics & Programme Implementation",
    shortName: "MoSPI",
    mandate: "Official GDP, CPI, unemployment and survey statistics.",
    url: "https://www.mospi.gov.in/",
    topics: ["economy", "policy"],
  },
  {
    id: "imd",
    name: "India Meteorological Department",
    shortName: "IMD",
    mandate: "Cyclone, rainfall and heatwave warnings; the only authorised forecaster.",
    url: "https://mausam.imd.gov.in/",
    topics: ["weather"],
  },
  {
    id: "ndma",
    name: "National Disaster Management Authority",
    shortName: "NDMA",
    mandate: "Disaster alerts, evacuation advisories and preparedness guidance.",
    url: "https://ndma.gov.in/",
    topics: ["weather", "general"],
  },
  {
    id: "isro",
    name: "Indian Space Research Organisation",
    shortName: "ISRO",
    mandate: "Launch schedules, mission status and space science announcements.",
    url: "https://www.isro.gov.in/",
    topics: ["science"],
  },
  {
    id: "eci",
    name: "Election Commission of India",
    shortName: "ECI",
    mandate: "Poll schedules, EVM/VVPAT facts, candidate and result data.",
    url: "https://www.eci.gov.in/",
    topics: ["elections"],
  },
  {
    id: "meity",
    name: "Ministry of Electronics & Information Technology",
    shortName: "MeitY",
    mandate: "IT rules, data protection and platform advisories.",
    url: "https://www.meity.gov.in/",
    topics: ["digital", "policy"],
  },
  {
    id: "cert-in",
    name: "Indian Computer Emergency Response Team",
    shortName: "CERT-In",
    mandate: "Cyber-security incident advisories and scam alerts.",
    url: "https://www.cert-in.org.in/",
    topics: ["digital"],
  },
  {
    id: "uidai",
    name: "Unique Identification Authority of India",
    shortName: "UIDAI",
    mandate: "Authoritative source for anything Aadhaar-related.",
    url: "https://uidai.gov.in/",
    topics: ["digital", "policy"],
  },
  {
    id: "railways",
    name: "Ministry of Railways",
    shortName: "Indian Railways",
    mandate: "Train services, fares, new lines and safety statements.",
    url: "https://indianrailways.gov.in/",
    topics: ["transport"],
  },
  {
    id: "morth",
    name: "Ministry of Road Transport & Highways",
    shortName: "MoRTH",
    mandate: "Highway projects, licensing rules and road-safety data.",
    url: "https://morth.nic.in/",
    topics: ["transport"],
  },
  {
    id: "agricoop",
    name: "Ministry of Agriculture & Farmers' Welfare",
    shortName: "MoA&FW",
    mandate: "MSP notifications, crop estimates and farmer scheme details.",
    url: "https://agriwelfare.gov.in/",
    topics: ["agriculture", "economy"],
  },
  {
    id: "mod",
    name: "Ministry of Defence",
    shortName: "MoD",
    mandate: "Official defence procurement, operations and recruitment statements.",
    url: "https://www.mod.gov.in/",
    topics: ["defence"],
  },
  {
    id: "data-gov",
    name: "Open Government Data Platform India",
    shortName: "data.gov.in",
    mandate: "Machine-readable datasets published by central and state bodies.",
    url: "https://data.gov.in/",
    topics: ["general", "economy", "policy", "science"],
  },
];

/** Phrase-level keywords. Ambiguous words (who, act, bill, data, app, market…) are avoided. */
export const TOPIC_KEYWORDS: Record<Exclude<Topic, "general">, string[]> = {
  health: ["health", "vaccine", "vaccination", "covid", "virus", "disease", "hospital", "doctor", "doctors", "medicine", "drug", "cure", "cures", "patient", "cancer", "outbreak", "world health organization", "icmr", "mohfw"],
  economy: ["gdp", "inflation", "rupee", "bank", "banks", "rbi", "reserve bank", "economy", "tax", "gst", "budget", "unemployment", "stock market", "share market", "sensex", "nifty", "loan", "currency", "currency note", "currency notes", "rupee notes", "repo rate", "price", "prices", "salary", "cash transactions"],
  policy: ["ministry", "government", "policy", "scheme", "parliament", "lok sabha", "rajya sabha", "lok sabha bill", "ordinance", "cabinet", "niti aayog", "reform", "subsidy", "yojana"],
  science: ["isro", "satellite", "satellite launch", "rocket launch", "mission", "research", "researchers", "study", "scientists", "space", "chandrayaan", "experiment", "moon", "mars", "peer reviewed"],
  weather: ["cyclone", "rain", "rainfall", "flood", "heatwave", "monsoon", "storm", "earthquake", "imd", "weather", "orange alert", "red alert", "temperature"],
  elections: ["election", "elections", "election commission", "vote", "voting", "evm", "vvpat", "exit poll", "opinion poll", "polling", "candidate", "constituency", "ballot", "voter"],
  digital: ["aadhaar", "uidai", "upi", "otp", "cyber", "hacked", "data breach", "data protection", "mobile app", "whatsapp", "online", "digital", "phone", "sim", "sim cards", "phishing", "internet", "it stocks"],
  transport: ["train", "railway", "railways", "metro", "highway", "expressway", "toll", "flight", "airport", "licence", "license", "bus fare", "bus service"],
  agriculture: ["farmer", "farmers", "crop", "msp", "wheat", "rice", "harvest", "fertiliser", "fertilizer", "agriculture", "mandi"],
  defence: ["army", "navy", "air force", "defence", "soldier", "border", "missile", "military", "agniveer"],
};

export type TopicHits = Partial<Record<Topic, number>>;

/** Count keyword hits per topic. "WHO" counts for health only when written in capitals. */
export function topicHitCounts(tokens: string[], raw: string): TopicHits {
  const hits: TopicHits = {};
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS) as [Topic, string[]][]) {
    const n = words.filter((w) => hasPhrase(tokens, w)).length;
    if (n > 0) hits[topic] = n;
  }
  if (upperTokens(raw).has("WHO") && phraseIndices(tokens, "who").length > 0) {
    hits.health = (hits.health ?? 0) + 1;
  }
  return hits;
}

const TOPIC_ORDER = Object.keys(TOPIC_KEYWORDS) as Topic[];

/** Topics ordered by hit count, ties by declaration order; "general" when nothing matched. */
export function topicsFromHits(hits: TopicHits): Topic[] {
  const found = TOPIC_ORDER.filter((t) => (hits[t] ?? 0) > 0).sort(
    (a, b) => (hits[b] ?? 0) - (hits[a] ?? 0) || TOPIC_ORDER.indexOf(a) - TOPIC_ORDER.indexOf(b),
  );
  return found.length ? found : ["general"];
}

export interface SourceMatch {
  source: OfficialSource;
  topic: Topic;
  /** Number of matching topic keywords in the claim (0 for the PIB fallback). */
  relevance: number;
}

/** How many sources the UI shows at most. */
export const MAX_SOURCES_SHOWN = 5;

/**
 * All matching official desks, ranked by number of matching topic keywords,
 * ties broken by registry order. PIB Fact Check is always included.
 */
export function matchSources(hits: TopicHits): SourceMatch[] {
  const out: (SourceMatch & { order: number })[] = [];
  OFFICIAL_SOURCES.forEach((source, order) => {
    let relevance = 0;
    let best: Topic = "general";
    let bestHits = 0;
    for (const t of source.topics) {
      const n = hits[t] ?? 0;
      relevance += n;
      if (n > bestHits) { bestHits = n; best = t; }
    }
    if (relevance > 0 || source.id === "pib-factcheck") out.push({ source, topic: best, relevance, order });
  });
  return out
    .sort((a, b) => b.relevance - a.relevance || a.order - b.order)
    .map(({ source, topic, relevance }) => ({ source, topic, relevance }));
}
