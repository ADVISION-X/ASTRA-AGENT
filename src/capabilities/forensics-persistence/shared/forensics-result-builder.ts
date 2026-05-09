import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type {
  ForensicsAbilityInput,
  ForensicsFailure,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsResult,
  StoredForensicsRecord,
} from "../schema.js";
import {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  ForensicsPersistedOutputSchema,
  ForensicsRecordRefSchema,
  ForensicsResultSchema,
} from "../schema.js";
import { buildForensicsProof } from "./forensics-proof-builder.js";
import { resolveForensicsPersistenceStatus } from "./forensics-status.js";

const buildForensicsOutput = (input: {
  storedRecord: StoredForensicsRecord | null;
  policyDecision: ForensicsPolicyDecision;
}) => input.storedRecord
  ? ForensicsPersistedOutputSchema.parse({
    recordRef: input.storedRecord.recordRef,
    storageRef: input.storedRecord.storageRef,
    artifactRefs: input.storedRecord.artifactRefs,
    persistedAt: input.storedRecord.persistedAt,
    storageOperation: input.policyDecision.storageOperation,
    idempotencyKey: input.policyDecision.idempotencyKey,
  })
  : null;

const buildForensicsRecordRef = (input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  storedRecord: StoredForensicsRecord | null;
}) => input.storedRecord?.recordRef ?? ForensicsRecordRefSchema.parse({
  recordType: input.request.recordType,
  recordId: `${input.request.recordType}:${input.policyDecision.idempotencyKey}`,
  storageRef: null,
});

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
  const output = buildForensicsOutput({ storedRecord: input.storedRecord, policyDecision: input.policyDecision });
  const recordRef = buildForensicsRecordRef({ request: input.request, policyDecision: input.policyDecision, storedRecord: input.storedRecord });
  const status = resolveForensicsPersistenceStatus({
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    integrityDecision: input.integrityDecision,
    storedRecord: input.storedRecord,
  });
  const reviewRequiredReason = status === "review_required" ? input.reviewRequiredReason : null;

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
    reviewRequiredReason,
    runtimeProof: buildForensicsProof({
      request: input.request,
      policyDecision: input.policyDecision,
      integrityDecision: input.integrityDecision,
      storedRecord: input.storedRecord,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      failureReason: input.failureReason,
      reviewRequiredReason,
      clock: input.clock,
    }),
    integrityDecision: input.integrityDecision,
    policyDecision: input.policyDecision,
  });
}
