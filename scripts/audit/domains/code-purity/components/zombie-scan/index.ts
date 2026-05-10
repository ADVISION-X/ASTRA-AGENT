import type { Finding } from "../../../../core/schema.js";

import { buildZombieGraph } from "./zombie-graph.js";
import { collectZombieCandidates } from "./zombie-catalog-main.js";
import { buildZombieFinding, resolveZombieCallerCount } from "./zombie-findings.js";

export const inspectZombieScan = async (repoRoot: string, relativePaths: string[]): Promise<Finding[]> => {
  const graph = await buildZombieGraph(repoRoot, relativePaths);
  const candidates = await collectZombieCandidates(graph);
  const findings: Finding[] = [];

  for (const candidate of candidates) {
    const lawfulCallerCount = resolveZombieCallerCount(graph, candidate);
    if (lawfulCallerCount !== 0) {
      continue;
    }
    findings.push(buildZombieFinding(candidate, lawfulCallerCount));
  }

  return findings;
};
