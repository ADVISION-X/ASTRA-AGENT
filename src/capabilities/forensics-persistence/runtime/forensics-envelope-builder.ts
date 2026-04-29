import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type {
  ForensicsAbilityInput,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsRecordEnvelope,
} from "../schema.js";
import { ForensicsRecordEnvelopeSchema } from "../schema.js";
import { buildCanonicalForensicsHash } from "./forensics-hash-builder.js";

export function buildForensicsEnvelope(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  recordId: string;
  clock: ForensicsClockPort;
}): ForensicsRecordEnvelope {
  const createdAt = input.clock.now();
  return ForensicsRecordEnvelopeSchema.parse({
    recordId: input.recordId,
    recordType: input.request.recordType,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId ?? null,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    createdAt,
    payload: input.request.payload,
    sourceRecordRefs: input.request.sourceRecordRefs,
    parentRefs: input.request.parentRefs,
    artifactRefs: input.request.artifactRefs,
    schemaVersion: input.policyDecision.schemaVersion,
    integrityHash: buildCanonicalForensicsHash({
      recordId: input.recordId,
      recordType: input.request.recordType,
      sessionId: input.request.sessionId,
      roundId: input.request.roundId,
      videoVisitId: input.request.videoVisitId ?? null,
      sourceAbilityGroupId: input.request.sourceAbilityGroupId,
      sourceChildCapabilityId: input.request.sourceChildCapabilityId,
      payload: input.request.payload,
      sourceRecordRefs: input.request.sourceRecordRefs,
      parentRefs: input.request.parentRefs,
      artifactRefs: input.request.artifactRefs,
      schemaVersion: input.policyDecision.schemaVersion,
      dataQualityFlags: input.request.dataQualityFlags,
      createdAt,
    }),
    dataQualityFlags: input.request.dataQualityFlags,
    idempotencyKey: input.policyDecision.idempotencyKey,
  });
}
