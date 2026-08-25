import { randomUUID } from "node:crypto";

import {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
} from "./schema.js";
import type {
  ForensicsChildCapabilityId,
  ForensicsProof,
} from "./schema.js";

type ForensicsProofTiming = Pick<ForensicsProof, "startedAt" | "endedAt" | "durationMs">;

type ForensicsProofContext = Pick<
  ForensicsProof,
  | "childCapabilityId"
  | "missionId"
  | "runId"
  | "sessionId"
  | "roundId"
  | "capabilityCallId"
  | "recordRef"
  | "artifactRef"
  | "storageRef"
  | "integrityHash"
>;

export const createForensicsProofTiming = (startedAt: string): ForensicsProofTiming => {
  const endedAt = new Date().toISOString();
  return {
    startedAt,
    endedAt,
    durationMs: Date.now() - new Date(startedAt).getTime(),
  };
};

export const resolveForensicsFailureReason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const buildForensicsSuccessProof = (
  context: ForensicsProofContext,
  timing: ForensicsProofTiming,
): ForensicsProof => ({
  proofId: randomUUID(),
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  status: "success",
  ...context,
  ...timing,
});

export const buildForensicsFailureProof = (
  childCapabilityId: ForensicsChildCapabilityId,
  failureReason: string,
  timing: ForensicsProofTiming,
  context: Pick<ForensicsProofContext, "missionId" | "runId" | "recordRef"> = {},
): ForensicsProof => ({
  proofId: randomUUID(),
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId,
  status: "failed",
  failureReason,
  ...context,
  ...timing,
});
