import { randomUUID } from "node:crypto";

import type { OrchestrationChildrenContext } from "../children-context.js";

type SaveEvidenceInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  userRequirementText: string;
  originalScreenshotRef: string;
  coordinateGridScreenshotRef: string;
  gridSpecRef: string;
  aiResultRef: string | null;
  saveReason: string;
  confidence: number;
  visualEvidence: string[];
};

export const systemSaveCurrentRoundEvidence = async (input: SaveEvidenceInput) =>
  input.ctx.forensics.appendRecord({
    childCapabilityId: "append-record",
    missionId: input.missionId,
    runId: input.runId,
    sessionId: "local",
    roundId: input.roundId,
    stepId: randomUUID(),
    capabilityCallId: randomUUID(),
    sourceCapabilityId: "orchestration",
    sourceChildCapabilityId: "mission-round-loop",
    recordType: "visual_evidence",
    recordPayload: {
      userRequirementText: input.userRequirementText,
      originalScreenshotRef: input.originalScreenshotRef,
      coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
      gridSpecRef: input.gridSpecRef,
      aiResultRef: input.aiResultRef,
      saveReason: input.saveReason,
      confidence: input.confidence,
      visualEvidence: input.visualEvidence,
    },
    artifactRefs: [
      input.originalScreenshotRef,
      input.coordinateGridScreenshotRef,
      input.gridSpecRef,
    ],
    parentRefs: input.aiResultRef ? [input.aiResultRef] : [],
    idempotencyKey: `pure-visual-round-save:${input.missionId}:${input.runId}:${input.roundId}`,
  });
