import { z } from "zod";

import { OcrTextResultSchema } from "../../types/evidence.js";
import {
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundLifecycleEventSchema,
  RoundStructuralLogSchema,
} from "../../types/evidence-packet.js";
import { ActionLogSchema } from "../../types/platform-action.js";
import { StoredAiResultSchema } from "../../types/stored-ai-result.js";
import {
  StructuredActionLogSchema,
  StructuredRuntimeEventSchema,
  StructuredRuntimeSnapshotSummarySchema,
} from "../../types/structured-log.js";

export const FORENSICS_PERSISTENCE_ABILITY_GROUP_ID = "forensics-persistence" as const;

export const ForensicsChildCapabilityIdSchema = z.enum([
  "write-structured-runtime-event",
  "write-structured-action-log",
  "write-evidence-record",
  "write-ai-result-record",
  "finalize-browse-ledger",
  "finalize-evidence-packet",
  "finalize-failed-record",
  "update-runtime-snapshot",
]);

export const ForensicsRecordTypeSchema = z.enum([
  "structured_runtime_event",
  "structured_action_log",
  "evidence_record",
  "ai_result_record",
  "browse_ledger_entry",
  "evidence_packet",
  "failed_record",
  "runtime_snapshot",
]);

export const ForensicsArtifactTypeSchema = z.enum(["image", "ocr_text", "json", "packet", "snapshot", "other"]);

export const ForensicsStorageOperationSchema = z.enum([
  "append-record",
  "replace-record-by-round",
  "replace-record-by-session",
  "update-runtime-snapshot",
]);

export const ForensicsFailureCodeSchema = z.enum([
  "unknown_child",
  "input_schema_invalid",
  "child_contract_mismatch",
  "policy_violation",
  "integrity_violation",
  "artifact_write_failed",
  "artifact_verification_failed",
  "storage_write_failed",
  "storage_read_failed",
  "output_schema_invalid",
  "dispatch_failure",
]);

export const ForensicsFailureSchema = z.object({
  code: ForensicsFailureCodeSchema,
  message: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
});

export const ForensicsRecordRefSchema = z.object({
  recordType: ForensicsRecordTypeSchema,
  recordId: z.string().min(1),
  storageRef: z.string().min(1).nullable().default(null),
});

export const ForensicsArtifactRefSchema = z.object({
  artifactType: ForensicsArtifactTypeSchema,
  artifactId: z.string().min(1),
  storageRef: z.string().min(1).nullable().default(null),
  sourceRecordRef: ForensicsRecordRefSchema.nullable().default(null),
});

export const ForensicsPersistencePolicySchema = z.object({
  mode: z.enum(["append", "replace-by-round", "replace-by-session"]),
  allowPartialRefs: z.boolean().default(false),
  allowExternalArtifactRef: z.boolean().default(false),
  onArtifactWriteFailure: z.enum(["failed", "review_required"]).default("failed"),
});

export const ForensicsIntegrityPolicySchema = z.object({
  requireSourceRecordRefs: z.boolean().default(false),
  requireParentRefs: z.boolean().default(false),
  requireArtifactRefs: z.boolean().default(false),
  requireStorageRef: z.boolean().default(false),
});

export const ForensicsPolicyDecisionSchema = z.object({
  childCapabilityId: ForensicsChildCapabilityIdSchema,
  recordType: ForensicsRecordTypeSchema,
  schemaVersion: z.string().min(1),
  persistenceMode: ForensicsPersistencePolicySchema.shape.mode,
  storageOperation: ForensicsStorageOperationSchema,
  idempotencyKey: z.string().min(1),
  allowPartialRefs: z.boolean(),
  allowExternalArtifactRef: z.boolean(),
  onArtifactWriteFailure: ForensicsPersistencePolicySchema.shape.onArtifactWriteFailure,
});

export const ForensicsIntegrityDecisionSchema = z.object({
  status: z.enum(["passed", "review_required", "failed"]),
  reason: z.string().min(1).nullable().default(null),
  requireSourceRecordRefs: z.boolean(),
  requireParentRefs: z.boolean(),
  requireArtifactRefs: z.boolean(),
  requireStorageRef: z.boolean(),
});

export const ImageEvidenceInputSchema = z.object({
  kind: z.enum(["video-screenshot", "comment-screenshot"]),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  platformId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceUrl: z.string().min(1),
  regionLabel: z.string().min(1),
  regionType: z.string().min(1),
  summary: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentLines: z.array(z.string().min(1)).optional(),
  sourceFilePath: z.string().min(1).optional(),
});

export const ForensicsStructuredRuntimeEventPayloadSchema = z.object({
  structuredRuntimeEvent: StructuredRuntimeEventSchema,
  roundLifecycleEvent: RoundLifecycleEventSchema.optional(),
});

export const ForensicsStructuredActionLogPayloadSchema = z.object({
  actionLog: ActionLogSchema.optional(),
  structuredActionLog: StructuredActionLogSchema,
});

export const ForensicsEvidenceRecordPayloadSchema = z.union([
  z.object({
    imageEvidenceInput: ImageEvidenceInputSchema,
  }),
  z.object({
    ocrTextResult: OcrTextResultSchema,
  }),
]);

export const ForensicsAiResultRecordPayloadSchema = z.object({
  aiResult: StoredAiResultSchema,
});

export const ForensicsBrowseLedgerPayloadSchema = z.object({
  browseLedgerEntry: BrowseLedgerEntrySchema,
  roundStructuralLog: RoundStructuralLogSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const ForensicsEvidencePacketPayloadSchema = z.object({
  evidencePacket: ProductDiscoveryEvidencePacketSchema,
  roundStructuralLog: RoundStructuralLogSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const ForensicsFailedRecordPayloadSchema = z.object({
  evidencePacket: ProductDiscoveryEvidencePacketSchema.nullable().default(null),
  browseLedgerEntry: BrowseLedgerEntrySchema.nullable().default(null),
  roundStructuralLog: RoundStructuralLogSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const ForensicsRuntimeSnapshotPayloadSchema = z.object({
  snapshotEvent: StructuredRuntimeEventSchema,
  snapshotSummary: StructuredRuntimeSnapshotSummarySchema.optional(),
});

export const ForensicsPersistedOutputSchema = z.object({
  recordRef: ForensicsRecordRefSchema,
  storageRef: z.string().min(1).nullable().default(null),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  persistedAt: z.string().datetime(),
  storageOperation: ForensicsStorageOperationSchema,
  idempotencyKey: z.string().min(1),
});

export const ForensicsRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  abilityGroupId: z.literal(FORENSICS_PERSISTENCE_ABILITY_GROUP_ID),
  childCapabilityId: ForensicsChildCapabilityIdSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: z.string().min(1),
  operationType: z.string().min(1),
  recordType: ForensicsRecordTypeSchema,
  recordId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: z.enum(["success", "failed", "review_required"]),
  storageOperation: ForensicsStorageOperationSchema,
  inputRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  outputRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  storageRef: z.string().min(1).nullable().default(null),
  integrityHash: z.string().min(1).nullable().default(null),
  policyDecision: ForensicsPolicyDecisionSchema,
  integrityDecision: ForensicsIntegrityDecisionSchema,
  failureReason: ForensicsFailureSchema.nullable().default(null),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

export const ForensicsResultSchema = z.object({
  abilityGroupId: z.literal(FORENSICS_PERSISTENCE_ABILITY_GROUP_ID),
  childCapabilityId: ForensicsChildCapabilityIdSchema,
  status: z.enum(["success", "failed", "review_required"]),
  recordType: ForensicsRecordTypeSchema,
  recordRef: ForensicsRecordRefSchema,
  storageRef: z.string().min(1).nullable().default(null),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  output: ForensicsPersistedOutputSchema.nullable().default(null),
  failureReason: ForensicsFailureSchema.nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  runtimeProof: ForensicsRuntimeProofSchema,
  integrityDecision: ForensicsIntegrityDecisionSchema,
  policyDecision: ForensicsPolicyDecisionSchema,
});

export const ForensicsRecordEnvelopeSchema = z.object({
  recordId: z.string().min(1),
  recordType: ForensicsRecordTypeSchema,
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: z.unknown(),
  sourceRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  parentRefs: z.array(ForensicsRecordRefSchema).default([]),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  schemaVersion: z.string().min(1),
  integrityHash: z.string().min(1),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  idempotencyKey: z.string().min(1),
});

export const StoredForensicsRecordSchema = z.object({
  recordRef: ForensicsRecordRefSchema,
  storageRef: z.string().min(1).nullable().default(null),
  envelope: ForensicsRecordEnvelopeSchema,
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  persistedAt: z.string().datetime(),
});

const ForensicsAbilityInputBaseSchema = z.object({
  abilityGroupId: z.literal(FORENSICS_PERSISTENCE_ABILITY_GROUP_ID),
  requestedBy: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  sourceRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  parentRefs: z.array(ForensicsRecordRefSchema).default([]),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  persistencePolicy: ForensicsPersistencePolicySchema,
  integrityPolicy: ForensicsIntegrityPolicySchema.partial().optional(),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  existingRecordId: z.string().min(1).optional(),
  schemaVersion: z.string().min(1).optional(),
  debugLogRef: z.string().min(1).nullable().optional(),
});

export const WriteStructuredRuntimeEventInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-structured-runtime-event"),
  recordType: z.literal("structured_runtime_event"),
  payload: ForensicsStructuredRuntimeEventPayloadSchema,
});

export const WriteStructuredActionLogInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-structured-action-log"),
  recordType: z.literal("structured_action_log"),
  payload: ForensicsStructuredActionLogPayloadSchema,
});

export const WriteEvidenceRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-evidence-record"),
  recordType: z.literal("evidence_record"),
  payload: ForensicsEvidenceRecordPayloadSchema,
});

export const WriteAiResultRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-ai-result-record"),
  recordType: z.literal("ai_result_record"),
  payload: ForensicsAiResultRecordPayloadSchema,
});

export const FinalizeBrowseLedgerInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-browse-ledger"),
  recordType: z.literal("browse_ledger_entry"),
  payload: ForensicsBrowseLedgerPayloadSchema,
});

export const FinalizeEvidencePacketInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-evidence-packet"),
  recordType: z.literal("evidence_packet"),
  payload: ForensicsEvidencePacketPayloadSchema,
});

export const FinalizeFailedRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-failed-record"),
  recordType: z.literal("failed_record"),
  payload: ForensicsFailedRecordPayloadSchema,
});

export const UpdateRuntimeSnapshotInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("update-runtime-snapshot"),
  recordType: z.literal("runtime_snapshot"),
  payload: ForensicsRuntimeSnapshotPayloadSchema,
});

export const ForensicsAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  WriteStructuredRuntimeEventInputSchema,
  WriteStructuredActionLogInputSchema,
  WriteEvidenceRecordInputSchema,
  WriteAiResultRecordInputSchema,
  FinalizeBrowseLedgerInputSchema,
  FinalizeEvidencePacketInputSchema,
  FinalizeFailedRecordInputSchema,
  UpdateRuntimeSnapshotInputSchema,
]);

export const ForensicsRecordQuerySchema = z.object({
  recordType: ForensicsRecordTypeSchema.optional(),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  childCapabilityId: ForensicsChildCapabilityIdSchema.optional(),
});

export type ForensicsAbilityInput = z.infer<typeof ForensicsAbilityInputSchema>;
export type ForensicsAbilityInputRequest = z.input<typeof ForensicsAbilityInputSchema>;
export type ForensicsArtifactRef = z.infer<typeof ForensicsArtifactRefSchema>;
export type ForensicsChildCapabilityId = z.infer<typeof ForensicsChildCapabilityIdSchema>;
export type ForensicsFailure = z.infer<typeof ForensicsFailureSchema>;
export type ForensicsIntegrityDecision = z.infer<typeof ForensicsIntegrityDecisionSchema>;
export type ForensicsIntegrityPolicy = z.infer<typeof ForensicsIntegrityPolicySchema>;
export type ForensicsPersistedOutput = z.infer<typeof ForensicsPersistedOutputSchema>;
export type ForensicsPersistencePolicy = z.infer<typeof ForensicsPersistencePolicySchema>;
export type ForensicsPersistencePolicyInput = z.input<typeof ForensicsPersistencePolicySchema>;
export type ForensicsPolicyDecision = z.infer<typeof ForensicsPolicyDecisionSchema>;
export type ForensicsRecordEnvelope = z.infer<typeof ForensicsRecordEnvelopeSchema>;
export type ForensicsRecordQuery = z.infer<typeof ForensicsRecordQuerySchema>;
export type ForensicsRecordRef = z.infer<typeof ForensicsRecordRefSchema>;
export type ForensicsRecordType = z.infer<typeof ForensicsRecordTypeSchema>;
export type ForensicsResult = z.infer<typeof ForensicsResultSchema>;
export type ForensicsRuntimeProof = z.infer<typeof ForensicsRuntimeProofSchema>;
export type StoredForensicsRecord = z.infer<typeof StoredForensicsRecordSchema>;
export type WriteStructuredRuntimeEventInput = z.input<typeof WriteStructuredRuntimeEventInputSchema>;
export type WriteStructuredActionLogInput = z.input<typeof WriteStructuredActionLogInputSchema>;
export type WriteEvidenceRecordInput = z.input<typeof WriteEvidenceRecordInputSchema>;
export type WriteAiResultRecordInput = z.input<typeof WriteAiResultRecordInputSchema>;
export type FinalizeBrowseLedgerInput = z.input<typeof FinalizeBrowseLedgerInputSchema>;
export type FinalizeEvidencePacketInput = z.input<typeof FinalizeEvidencePacketInputSchema>;
export type FinalizeFailedRecordInput = z.input<typeof FinalizeFailedRecordInputSchema>;
export type UpdateRuntimeSnapshotInput = z.input<typeof UpdateRuntimeSnapshotInputSchema>;
