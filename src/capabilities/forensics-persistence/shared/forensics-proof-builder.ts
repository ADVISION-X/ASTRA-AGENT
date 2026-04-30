import { createHash } from "node:crypto";

import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type {
  ForensicsAbilityInput,
  ForensicsFailure,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsRuntimeProof,
  StoredForensicsRecord,
} from "../schema.js";
import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, ForensicsRuntimeProofSchema } from "../schema.js";

function buildProofId(seed: string): string {
  return `forensics-proof:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

export function buildForensicsProof(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  storedRecord: StoredForensicsRecord | null;
  startedAt: string;
  endedAt: string;
  failureReason: ForensicsFailure | null;
  reviewRequiredReason: string | null;
  clock: ForensicsClockPort;
}): ForensicsRuntimeProof {
  const durationMs = Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime());
  const recordId = input.storedRecord?.recordRef.recordId ?? `${input.request.recordType}:${input.policyDecision.idempotencyKey}`;
  const status = input.failureReason
    ? "failed"
    : input.reviewRequiredReason || input.integrityDecision.status === "review_required"
      ? "review_required"
      : "success";

  return ForensicsRuntimeProofSchema.parse({
    proofId: buildProofId(`${recordId}:${input.endedAt}`),
    runId: `${input.request.sourceAbilityGroupId}:${input.request.sourceChildCapabilityId}:${recordId}`,
    missionId: input.request.sourceAbilityGroupId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId ?? null,
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    operationType: input.request.childCapabilityId,
    recordType: input.request.recordType,
    recordId,
    idempotencyKey: input.policyDecision.idempotencyKey,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs,
    status,
    storageOperation: input.policyDecision.storageOperation,
    inputRecordRefs: [...input.request.sourceRecordRefs, ...input.request.parentRefs],
    outputRecordRefs: input.storedRecord ? [input.storedRecord.recordRef] : [],
    artifactRefs: input.storedRecord?.artifactRefs ?? input.request.artifactRefs,
    storageRef: input.storedRecord?.storageRef ?? null,
    integrityHash: input.storedRecord?.envelope.integrityHash ?? null,
    policyDecision: input.policyDecision,
    integrityDecision: input.integrityDecision,
    failureReason: input.failureReason,
    dataQualityFlags: input.request.dataQualityFlags,
  });
}