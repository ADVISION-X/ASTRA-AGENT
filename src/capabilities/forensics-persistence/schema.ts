import { z } from "zod";

import {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  ForensicsArtifactRefSchema,
  ForensicsChildCapabilityIdSchema,
  ForensicsFailureSchema,
  ForensicsIntegrityDecisionSchema,
  ForensicsIntegrityPolicySchema,
  ForensicsPersistedOutputSchema,
  ForensicsPersistencePolicySchema,
  ForensicsPolicyDecisionSchema,
  ForensicsRecordEnvelopeSchema,
  ForensicsRecordQuerySchema,
  ForensicsRecordRefSchema,
  ForensicsRecordTypeSchema,
  ForensicsResultSchema,
  ForensicsRuntimeProofFieldSchemas,
  ImageEvidenceInputSchema,
  StoredForensicsRecordSchema,
  type ForensicsArtifactRef,
  type ForensicsChildCapabilityId,
  type ForensicsFailure,
  type ForensicsIntegrityDecision,
  type ForensicsIntegrityPolicy,
  type ForensicsPersistedOutput,
  type ForensicsPersistencePolicy,
  type ForensicsPersistencePolicyInput,
  type ForensicsPolicyDecision,
  type ForensicsRecordEnvelope,
  type ForensicsRecordQuery,
  type ForensicsRecordRef,
  type ForensicsRecordType,
  type ForensicsResult,
  type ForensicsRuntimeProof,
  type StoredForensicsRecord,
} from "./shared/forensics-base-schema.js";
import {
  FinalizeBrowseLedgerInputSchema,
  ForensicsBrowseLedgerPayloadSchema,
} from "./children/finalize-browse-ledger/schema.js";
import {
  FinalizeEvidencePacketInputSchema,
  ForensicsEvidencePacketPayloadSchema,
} from "./children/finalize-evidence-packet/schema.js";
import {
  FinalizeFailedRecordInputSchema,
  ForensicsFailedRecordPayloadSchema,
} from "./children/finalize-failed-record/schema.js";
import {
  UpdateRuntimeSnapshotInputSchema,
  ForensicsRuntimeSnapshotPayloadSchema,
} from "./children/update-runtime-snapshot/schema.js";
import {
  WriteAiResultRecordInputSchema,
  ForensicsAiResultRecordPayloadSchema,
} from "./children/write-ai-result-record/schema.js";
import {
  WriteEvidenceRecordInputSchema,
  ForensicsEvidenceRecordPayloadSchema,
} from "./children/write-evidence-record/schema.js";
import {
  WriteStructuredActionLogInputSchema,
  ForensicsStructuredActionLogPayloadSchema,
} from "./children/write-structured-action-log/schema.js";
import {
  WriteStructuredRuntimeEventInputSchema,
  ForensicsStructuredRuntimeEventPayloadSchema,
} from "./children/write-structured-runtime-event/schema.js";

const ForensicsAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  WriteStructuredRuntimeEventInputSchema,
  WriteStructuredActionLogInputSchema,
  WriteEvidenceRecordInputSchema,
  WriteAiResultRecordInputSchema,
  FinalizeBrowseLedgerInputSchema,
  FinalizeEvidencePacketInputSchema,
  FinalizeFailedRecordInputSchema,
  UpdateRuntimeSnapshotInputSchema,
]);

const ForensicsRuntimeProofSchema = z.object({
  proofId: ForensicsRuntimeProofFieldSchemas.proofId,
  runId: ForensicsRuntimeProofFieldSchemas.runId,
  missionId: ForensicsRuntimeProofFieldSchemas.missionId,
  sessionId: ForensicsRuntimeProofFieldSchemas.sessionId,
  roundId: ForensicsRuntimeProofFieldSchemas.roundId,
  videoVisitId: ForensicsRuntimeProofFieldSchemas.videoVisitId,
  abilityGroupId: ForensicsRuntimeProofFieldSchemas.abilityGroupId,
  childCapabilityId: ForensicsRuntimeProofFieldSchemas.childCapabilityId,
  sourceAbilityGroupId: ForensicsRuntimeProofFieldSchemas.sourceAbilityGroupId,
  sourceChildCapabilityId: ForensicsRuntimeProofFieldSchemas.sourceChildCapabilityId,
  operationType: ForensicsRuntimeProofFieldSchemas.operationType,
  recordType: ForensicsRuntimeProofFieldSchemas.recordType,
  recordId: ForensicsRuntimeProofFieldSchemas.recordId,
  idempotencyKey: ForensicsRuntimeProofFieldSchemas.idempotencyKey,
  runLockId: ForensicsRuntimeProofFieldSchemas.runLockId,
  cancellationTokenRef: ForensicsRuntimeProofFieldSchemas.cancellationTokenRef,
  resumeCheckpointRef: ForensicsRuntimeProofFieldSchemas.resumeCheckpointRef,
  timeoutMs: ForensicsRuntimeProofFieldSchemas.timeoutMs,
  retryCount: ForensicsRuntimeProofFieldSchemas.retryCount,
  maxRetry: ForensicsRuntimeProofFieldSchemas.maxRetry,
  startedAt: ForensicsRuntimeProofFieldSchemas.startedAt,
  endedAt: ForensicsRuntimeProofFieldSchemas.endedAt,
  durationMs: ForensicsRuntimeProofFieldSchemas.durationMs,
  status: ForensicsRuntimeProofFieldSchemas.status,
  storageOperation: ForensicsRuntimeProofFieldSchemas.storageOperation,
  inputRecordRefs: ForensicsRuntimeProofFieldSchemas.inputRecordRefs,
  outputRecordRefs: ForensicsRuntimeProofFieldSchemas.outputRecordRefs,
  artifactRefs: ForensicsRuntimeProofFieldSchemas.artifactRefs,
  storageRef: ForensicsRuntimeProofFieldSchemas.storageRef,
  integrityHash: ForensicsRuntimeProofFieldSchemas.integrityHash,
  policyDecision: ForensicsRuntimeProofFieldSchemas.policyDecision,
  integrityDecision: ForensicsRuntimeProofFieldSchemas.integrityDecision,
  failureReason: ForensicsRuntimeProofFieldSchemas.failureReason,
  dataQualityFlags: ForensicsRuntimeProofFieldSchemas.dataQualityFlags,
});

type ForensicsAbilityInput = z.infer<typeof ForensicsAbilityInputSchema>;
type ForensicsAbilityInputRequest = z.input<typeof ForensicsAbilityInputSchema>;
type WriteStructuredRuntimeEventInput = z.input<typeof WriteStructuredRuntimeEventInputSchema>;
type WriteStructuredActionLogInput = z.input<typeof WriteStructuredActionLogInputSchema>;
type WriteEvidenceRecordInput = z.input<typeof WriteEvidenceRecordInputSchema>;
type WriteAiResultRecordInput = z.input<typeof WriteAiResultRecordInputSchema>;
type FinalizeBrowseLedgerInput = z.input<typeof FinalizeBrowseLedgerInputSchema>;
type FinalizeEvidencePacketInput = z.input<typeof FinalizeEvidencePacketInputSchema>;
type FinalizeFailedRecordInput = z.input<typeof FinalizeFailedRecordInputSchema>;
type UpdateRuntimeSnapshotInput = z.input<typeof UpdateRuntimeSnapshotInputSchema>;

export {
  ForensicsAbilityInputSchema,
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  ForensicsArtifactRefSchema,
  ForensicsChildCapabilityIdSchema,
  ForensicsFailureSchema,
  ForensicsIntegrityDecisionSchema,
  ForensicsIntegrityPolicySchema,
  ForensicsPersistedOutputSchema,
  ForensicsPersistencePolicySchema,
  ForensicsPolicyDecisionSchema,
  ForensicsRecordEnvelopeSchema,
  ForensicsRecordQuerySchema,
  ForensicsRecordRefSchema,
  ForensicsRecordTypeSchema,
  ForensicsResultSchema,
  ForensicsRuntimeProofSchema,
  ImageEvidenceInputSchema,
  StoredForensicsRecordSchema,
  ForensicsStructuredRuntimeEventPayloadSchema,
  ForensicsStructuredActionLogPayloadSchema,
  ForensicsEvidenceRecordPayloadSchema,
  ForensicsAiResultRecordPayloadSchema,
  ForensicsBrowseLedgerPayloadSchema,
  ForensicsEvidencePacketPayloadSchema,
  ForensicsFailedRecordPayloadSchema,
  ForensicsRuntimeSnapshotPayloadSchema,
  WriteStructuredRuntimeEventInputSchema,
  WriteStructuredActionLogInputSchema,
  WriteEvidenceRecordInputSchema,
  WriteAiResultRecordInputSchema,
  FinalizeBrowseLedgerInputSchema,
  FinalizeEvidencePacketInputSchema,
  FinalizeFailedRecordInputSchema,
  UpdateRuntimeSnapshotInputSchema,
};

export type {
  ForensicsAbilityInput,
  ForensicsAbilityInputRequest,
  ForensicsArtifactRef,
  ForensicsChildCapabilityId,
  ForensicsFailure,
  ForensicsIntegrityDecision,
  ForensicsIntegrityPolicy,
  ForensicsPersistedOutput,
  ForensicsPersistencePolicy,
  ForensicsPersistencePolicyInput,
  ForensicsPolicyDecision,
  ForensicsRecordEnvelope,
  ForensicsRecordQuery,
  ForensicsRecordRef,
  ForensicsRecordType,
  ForensicsResult,
  ForensicsRuntimeProof,
  StoredForensicsRecord,
  WriteStructuredRuntimeEventInput,
  WriteStructuredActionLogInput,
  WriteEvidenceRecordInput,
  WriteAiResultRecordInput,
  FinalizeBrowseLedgerInput,
  FinalizeEvidencePacketInput,
  FinalizeFailedRecordInput,
  UpdateRuntimeSnapshotInput,
};
