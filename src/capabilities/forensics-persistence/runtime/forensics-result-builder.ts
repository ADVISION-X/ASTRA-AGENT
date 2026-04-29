import type {
  ForensicsAbilityInput,
  ForensicsFailure,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsResult,
  StoredForensicsRecord,
} from "../schema.js";
import {
  ForensicsPersistedOutputSchema,
  ForensicsRecordRefSchema,
  ForensicsResultSchema,
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
} from "../schema.js";
import { buildForensicsProof } from "./forensics-proof-builder.js";
import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";

export function buildForensicsResult(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  storedRecord: StoredForensicsRecord | null;
  startedAt: string;
  endedAt: string;
  failureReason: ForensicsFailure | null;
  reviewRequiredReason: string | null;
  clock: ForensicsClockPort;
}): ForensicsResult {
  const output = input.storedRecord
    ? ForensicsPersistedOutputSchema.parse({
      recordRef: input.storedRecord.recordRef,
      storageRef: input.storedRecord.storageRef,
      artifactRefs: input.storedRecord.artifactRefs,
      persistedAt: input.storedRecord.persistedAt,
      storageOperation: input.policyDecision.storageOperation,
      idempotencyKey: input.policyDecision.idempotencyKey,
    })
    : null;

  const recordRef = input.storedRecord?.recordRef ?? ForensicsRecordRefSchema.parse({
    recordType: input.request.recordType,
    recordId: `${input.request.recordType}:${input.policyDecision.idempotencyKey}`,
    storageRef: null,
  });

  const status = input.failureReason
    ? "failed"
    : input.reviewRequiredReason || input.integrityDecision.status === "review_required"
      ? "review_required"
      : "success";

  return ForensicsResultSchema.parse({
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    status,
    recordType: input.request.recordType,
    recordRef,
    storageRef: input.storedRecord?.storageRef ?? null,
    artifactRefs: input.storedRecord?.artifactRefs ?? input.request.artifactRefs,
    output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    runtimeProof: buildForensicsProof({
      request: input.request,
      policyDecision: input.policyDecision,
      integrityDecision: input.integrityDecision,
      storedRecord: input.storedRecord,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      clock: input.clock,
    }),
    integrityDecision: input.integrityDecision,
    policyDecision: input.policyDecision,
  });
}
