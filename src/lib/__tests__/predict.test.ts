import { describe, expect, it } from "vitest";
import { predict } from "../predict";

/** Fixed headlines; the snapshot is updated deliberately when the engine changes. */
const HEADLINES: string[] = [
  "Shocking secret cure doctors hate, share before it gets deleted!",
  "The Ministry of Finance announced a revised GST rate schedule on 1 April 2024.",
  "RBI keeps repo rate unchanged at 6.5 percent, governor says at press conference.",
  "Forward this to everyone: banks will be closed for ten days from tomorrow.",
  "According to IMD officials, heavy rainfall is expected in Kerala this week.",
  "You won't believe what this politician secretly did overnight.",
  "ISRO confirmed the successful launch of its new navigation satellite.",
  "Big pharma does not want you to know about this miracle herb.",
  "The Election Commission issued a press release on the polling schedule.",
  "Viral video claims the government will give free laptops to all students.",
  "Researchers published a peer-reviewed study on air pollution in Delhi.",
  "Wake up! Mainstream media is hiding the hidden truth about vaccines.",
  "India beat Australia by five wickets in the second Test in Chennai.",
  "PIB Fact Check: the claim that new 2000 rupee notes carry a GPS chip is fake news.",
  "The government has quietly decided to ban all cash transactions above Rs 2000 from next month, as per the Ministry of Finance.",
  "According to a statement by the Ministry of Health, drinking hot water every hour cures covid, officials confirmed on 3 March 2025.",
  "The whole market may decide to separate the novel database from the forward plan.",
  "UIDAI advisory: never share your Aadhaar OTP with anyone over the phone.",
  "Act now, 100% guaranteed returns from this new investment scheme!",
  "Sensex closes 300 points higher as IT stocks rally, data shows.",
];

describe("predict() snapshot", () => {
  it("scores fixed headlines identically", () => {
    const out = HEADLINES.map((text) => {
      const r = predict(text);
      return {
        text,
        label: r.label,
        confidence: r.confidenceScore,
        aspects: r.aspects.map((a) => [a.id, a.score]),
        topics: r.topics,
      };
    });
    expect(out).toMatchSnapshot();
  });
});
