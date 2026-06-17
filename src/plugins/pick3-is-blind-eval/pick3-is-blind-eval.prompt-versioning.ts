import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Pick3PlaybookRecord } from "./pick3-is-blind-eval.playbook.js";
import type { Pick3FailureReviewRecord, Pick3Position } from "./pick3-is-blind-eval.schema.js";

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

const positionSummary = (
  position: Pick3Position,
  reviews: readonly Pick3FailureReviewRecord[],
): string => reviews
  .filter((review) => review.position === position)
  .map((review) => `- ${review.failureType}: ${review.repairInstruction}`)
  .join("\n");

export const writeCandidatePick3Playbooks = (input: {
  artifactDir: string;
  activePlaybooks: readonly Pick3PlaybookRecord[];
  failureReviews: readonly Pick3FailureReviewRecord[];
}): Pick3PlaybookRecord[] => {
  if (input.failureReviews.length === 0) return [];
  const candidateDir = path.join(input.artifactDir, "playbook_candidates");
  mkdirSync(candidateDir, { recursive: true });
  const candidates: Pick3PlaybookRecord[] = [];
  for (const playbook of input.activePlaybooks) {
    const summary = positionSummary(playbook.position, input.failureReviews);
    if (!summary) continue;
    const content = [
      `# Pick3 ${playbook.position} L80 Candidate Playbook v${playbook.version + 1}`,
      "",
      "Status: candidate",
      "Accuracy use: next sealed blind batch only.",
      "",
      "Repair instructions from failed cases:",
      summary,
      "",
      "Do not memorize concrete answers. Use these repairs only as visual grammar constraints.",
    ].join("\n");
    const contentHash = hashText(content);
    const contentPath = path.join(candidateDir, `is_${playbook.position}_l80_v${playbook.version + 1}_${contentHash.slice(0, 8)}.md`);
    writeFileSync(contentPath, `${content}\n`);
    candidates.push({
      ...playbook,
      playbookVersionId: `pick3_${playbook.position}_l80_v${playbook.version + 1}_candidate_${randomUUID()}`,
      version: playbook.version + 1,
      status: "candidate",
      sourceKind: "agent_builtin",
      contentPath,
      contentHash,
      parentPlaybookVersionId: playbook.playbookVersionId,
      createdFromFailureReviewId: input.failureReviews.find((review) => review.position === playbook.position)?.failureReviewId ?? null,
      notes: "Candidate repair Playbook. Not active until promoted and validated on a new sealed blind batch.",
    });
  }
  return candidates;
};
