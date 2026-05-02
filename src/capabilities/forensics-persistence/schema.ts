import { z } from "zod";

import {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  ForensicsArtifactRefSchema,
  ForensicsChildCapabilityIdSchema,
  ForensicsFailureSchema,
  ForensicsIntegrityDecisionSchema,
  ForensicsIntegrityPolicySchema,
  ForensicsPersistedOutputSchema,
  ForensicsPlainObjectSchema,
  ForensicsPersistencePolicySchema,
  ForensicsPolicyDecisionSchema,
  ForensicsRecordEnvelopeSchema,
  ForensicsRecordQuerySchema,
  ForensicsRecordRefSchema,
  ForensicsRecordTypeSchema,
  ForensicsResultSchema,
  ForensicsRuntimeProofSchema as BaseForensicsRuntimeProofSchema,
  ForensicsStorageOperationSchema,
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
  type ForensicsStorageOperation,
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

const ForensicsRuntimeProofSchema = BaseForensicsRuntimeProofSchema;

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
  ForensicsStorageOperation,
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
