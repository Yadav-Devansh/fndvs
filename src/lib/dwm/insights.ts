/**
 * DWM Concept: data mining — insights derived from the data, never hard-coded.
 */

import type { FactVerification, Warehouse } from "./etl";
import type { ClusterSummary } from "./kmeans";
import { aspectProfile, byTopic, round1 } from "./olap";
import { ASPECT_LABELS } from "./etl";

export interface Insight {
  title: string;
  body: string;
}

export function discoverInsights(
  wh: Warehouse,
  facts: FactVerification[],
  clusters: ClusterSummary[],
): Insight[] {
  if (facts.length === 0) return [];
  const out: Insight[] = [];
  const topics = byTopic(wh, facts).filter((t) => t.total >= 1);
  const aspects = aspectProfile(facts, ASPECT_LABELS);

  const worstTopic = [...topics].sort((a, b) => b.fakePct - a.fakePct)[0];
  if (worstTopic) {
    out.push({
      title: "Topic with the most fake claims",
      body: `“${worstTopic.topic}” has the highest share of fake verdicts at ${worstTopic.fakePct}% (${worstTopic.fake} of ${worstTopic.total} claims).`,
    });
  }

  const worstAspect = [...aspects].sort((a, b) => b.failRate - a.failRate)[0];
  if (worstAspect) {
    out.push({
      title: "Most frequently failing credibility aspect",
      body: `“${worstAspect.aspect}” fails on ${worstAspect.failRate}% of records, with a mean score of ${worstAspect.avg}/100.`,
    });
  }

  const worstCluster = [...clusters].sort((a, b) => b.fakePct - a.fakePct)[0];
  if (worstCluster) {
    out.push({
      title: "Highest-risk cluster",
      body: `Cluster ${worstCluster.clusterId + 1} (${worstCluster.label}) groups ${worstCluster.size} claims and is ${worstCluster.fakePct}% fake, averaging ${worstCluster.avgConfidence}% confidence.`,
    });
  }

  const lowestConf = [...topics].sort((a, b) => a.avgConfidence - b.avgConfidence)[0];
  if (lowestConf) {
    out.push({
      title: "Topic with the lowest average confidence",
      body: `“${lowestConf.topic}” averages ${lowestConf.avgConfidence}% confidence, so verdicts in this area need manual corroboration most often.`,
    });
  }

  const low = facts.filter((f) => f.confidence_band === "Low").length;
  out.push({
    title: "Low-confidence share",
    body: `${round1((low / facts.length) * 100)}% of warehouse records (${low} of ${facts.length}) fall in the Low confidence band (<60).`,
  });

  const biggestGap = [...aspects].sort((a, b) => b.gap - a.gap)[0];
  if (biggestGap) {
    out.push({
      title: "Aspect that separates fake from real best",
      body: `“${biggestGap.aspect}” shows the widest gap: ${biggestGap.realAvg} average on real claims versus ${biggestGap.fakeAvg} on fake ones (Δ ${biggestGap.gap}).`,
    });
  }

  return out;
}
