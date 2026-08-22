/**
 * MOCK VERIFIED-SOURCE REGISTRY.
 *
 * A curated list of real Indian government / statutory bodies and their public
 * portals. The *matching* of a submission to a source is simulated locally
 * (keyword → topic → source), but every organisation, mandate and URL below is
 * genuine, so the corroboration panel points users at somewhere real to check.
 */

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

const TOPIC_KEYWORDS: Record<Exclude<Topic, "general">, string[]> = {
  health: ["health", "vaccine", "vaccination", "covid", "virus", "disease", "hospital", "doctor", "doctors", "medicine", "drug", "cure", "patient", "cancer", "outbreak", "who"],
  economy: ["gdp", "inflation", "rupee", "bank", "rbi", "economy", "tax", "gst", "budget", "unemployment", "market", "sensex", "loan", "currency", "note", "price", "prices", "salary"],
  policy: ["ministry", "government", "policy", "scheme", "parliament", "bill", "act", "cabinet", "niti", "reform", "subsidy", "yojana"],
  science: ["isro", "satellite", "launch", "mission", "research", "study", "scientists", "space", "chandrayaan", "experiment", "moon", "mars"],
  weather: ["cyclone", "rain", "rainfall", "flood", "heatwave", "monsoon", "storm", "earthquake", "imd", "weather", "alert", "temperature"],
  elections: ["election", "vote", "voting", "evm", "vvpat", "poll", "polls", "candidate", "constituency", "ballot", "voter"],
  digital: ["aadhaar", "upi", "otp", "cyber", "hacked", "data", "app", "whatsapp", "online", "digital", "phone", "sim", "link", "internet"],
  transport: ["train", "railway", "railways", "metro", "highway", "expressway", "toll", "flight", "airport", "licence", "license", "bus"],
  agriculture: ["farmer", "farmers", "crop", "msp", "wheat", "rice", "harvest", "fertiliser", "fertilizer", "agriculture", "mandi"],
  defence: ["army", "navy", "air force", "defence", "soldier", "border", "missile", "military", "agniveer"],
};

export function detectTopics(cleanedText: string): Topic[] {
  const found: Topic[] = [];
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS) as [Topic, string[]][]) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(cleanedText))) found.push(topic);
  }
  if (found.length === 0) found.push("general");
  return found.slice(0, 3);
}

export interface SourceMatch {
  source: OfficialSource;
  topic: Topic;
  /** Simulated relevance of this desk to the submitted claim. */
  relevance: number;
}

/** Deterministically pick the official desks a human verifier should check. */
export function matchSources(topics: Topic[], seed: number): SourceMatch[] {
  const picked = new Map<string, SourceMatch>();
  for (const topic of topics) {
    const pool = OFFICIAL_SOURCES.filter((s) => s.topics.includes(topic));
    pool.slice(0, 2).forEach((source, i) => {
      if (!picked.has(source.id)) {
        picked.set(source.id, {
          source,
          topic,
          relevance: Math.min(98, 74 + ((seed >> (i + 1)) % 20) + (i === 0 ? 6 : 0)),
        });
      }
    });
  }
  // PIB Fact Check is always worth checking for anything viral.
  const pib = OFFICIAL_SOURCES.find((s) => s.id === "pib-factcheck")!;
  if (!picked.has(pib.id)) {
    picked.set(pib.id, { source: pib, topic: "general", relevance: 80 });
  }
  return [...picked.values()].sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}
