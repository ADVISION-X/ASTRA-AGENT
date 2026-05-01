import { z } from "zod";

const FORENSICS_PERSISTENCE_ABILITY_GROUP_ID = "forensics-persistence" as const;
const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeInt = z.number().int().nonnegative();

const ForensicsChildCapabilityIdSchema = z.enum([
  "write-structured-runtime-event",
  "write-structured-action-log",
  "write-evidence-record",
  "write-ai-result-record",
  "finalize-browse-ledger",
  "finalize-evidence-packet",
  "finalize-failed-record",
  "update-runtime-snapshot",
]);

const ForensicsRecordTypeSchema = z.enum([
  "structured_runtime_event",
  "structured_action_log",
  "evidence_record",
  "ai_result_record",
  "browse_ledger_entry",
  "evidence_packet",
  "failed_record",
  "runtime_snapshot",
]);

const ForensicsArtifactTypeSchema = z.enum(["image", "ocr_text", "json", "packet", "snapshot", "other"]);

const ForensicsStorageOperationSchema = z.enum([
  "append-record",
  "replace-record-by-round",
  "replace-record-by-session",
  "update-runtime-snapshot",
]);

const ForensicsFailureCodeSchema = z.enum([
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

const ForensicsFailureSchema = z.object({
  code: ForensicsFailureCodeSchema,
  message: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
});

const ForensicsRecordRefSchema = z.object({
  recordType: ForensicsRecordTypeSchema,
  recordId: z.string().min(1),
  storageRef: z.string().min(1).nullable().default(null),
});

const ForensicsArtifactRefSchema = z.object({
  artifactType: ForensicsArtifactTypeSchema,
  artifactId: z.string().min(1),
  storageRef: z.string().min(1).nullable().default(null),
  sourceRecordRef: ForensicsRecordRefSchema.nullable().default(null),
});

const ForensicsPersistencePolicySchema = z.object({
  mode: z.enum(["append", "replace-by-round", "replace-by-session"]),
  allowPartialRefs: z.boolean().default(false),
  allowExternalArtifactRef: z.boolean().default(false),
  onArtifactWriteFailure: z.enum(["failed", "review_required"]).default("failed"),
});

const ForensicsIntegrityPolicySchema = z.object({
  requireSourceRecordRefs: z.boolean().default(false),
  requireParentRefs: z.boolean().default(false),
  requireArtifactRefs: z.boolean().default(false),
  requireStorageRef: z.boolean().default(false),
});

const ForensicsPolicyDecisionSchema = z.object({
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

const ForensicsIntegrityDecisionSchema = z.object({
  status: z.enum(["passed", "review_required", "failed"]),
  reason: z.string().min(1).nullable().default(null),
  requireSourceRecordRefs: z.boolean(),
  requireParentRefs: z.boolean(),
  requireArtifactRefs: z.boolean(),
  requireStorageRef: z.boolean(),
});

const ImageEvidenceInputSchema = z.object({
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

const ForensicsPersistedOutputSchema = z.object({
  recordRef: ForensicsRecordRefSchema,
  storageRef: z.string().min(1).nullable().default(null),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  persistedAt: z.string().datetime(),
  storageOperation: ForensicsStorageOperationSchema,
  idempotencyKey: z.string().min(1),
});

const ForensicsRuntimeProofFieldSchemas = {
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
  runLockId: nullableString,
  cancellationTokenRef: nullableString,
  resumeCheckpointRef: nullableString,
  timeoutMs: nonNegativeInt.nullable().default(null),
  retryCount: nonNegativeInt.default(0),
  maxRetry: nonNegativeInt.default(0),
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
};

const ForensicsRuntimeProofSchema = z.object(ForensicsRuntimeProofFieldSchemas);

const ForensicsResultSchema = z.object({
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

const ForensicsRecordEnvelopeSchema = z.object({
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

const StoredForensicsRecordSchema = z.object({
  recordRef: ForensicsRecordRefSchema,
  storageRef: z.string().min(1).nullable().default(null),
  envelope: ForensicsRecordEnvelopeSchema,
  persistedAt: z.string().datetime(),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
});

const ForensicsRecordQuerySchema = z.object({
  recordType: ForensicsRecordTypeSchema.optional(),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  childCapabilityId: ForensicsChildCapabilityIdSchema.optional(),
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

type ForensicsArtifactRef = z.infer<typeof ForensicsArtifactRefSchema>;
type ForensicsChildCapabilityId = z.infer<typeof ForensicsChildCapabilityIdSchema>;
type ForensicsFailure = z.infer<typeof ForensicsFailureSchema>;
type ForensicsIntegrityDecision = z.infer<typeof ForensicsIntegrityDecisionSchema>;
type ForensicsIntegrityPolicy = z.infer<typeof ForensicsIntegrityPolicySchema>;
type ForensicsPersistedOutput = z.infer<typeof ForensicsPersistedOutputSchema>;
type ForensicsPersistencePolicy = z.infer<typeof ForensicsPersistencePolicySchema>;
type ForensicsPersistencePolicyInput = z.input<typeof ForensicsPersistencePolicySchema>;
type ForensicsPolicyDecision = z.infer<typeof ForensicsPolicyDecisionSchema>;
type ForensicsRecordEnvelope = z.infer<typeof ForensicsRecordEnvelopeSchema>;
type ForensicsRecordQuery = z.infer<typeof ForensicsRecordQuerySchema>;
type ForensicsRecordRef = z.infer<typeof ForensicsRecordRefSchema>;
type ForensicsRecordType = z.infer<typeof ForensicsRecordTypeSchema>;
type ForensicsResult = z.infer<typeof ForensicsResultSchema>;
type ForensicsRuntimeProof = z.infer<typeof ForensicsRuntimeProofSchema>;
type StoredForensicsRecord = z.infer<typeof StoredForensicsRecordSchema>;

export {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  ForensicsChildCapabilityIdSchema,
  ForensicsRecordTypeSchema,
  ForensicsArtifactTypeSchema,
  ForensicsStorageOperationSchema,
  ForensicsFailureCodeSchema,
  ForensicsFailureSchema,
  ForensicsRecordRefSchema,
  ForensicsArtifactRefSchema,
  ForensicsPersistencePolicySchema,
  ForensicsIntegrityPolicySchema,
  ForensicsPolicyDecisionSchema,
  ForensicsIntegrityDecisionSchema,
  ImageEvidenceInputSchema,
  ForensicsPersistedOutputSchema,
  ForensicsRuntimeProofFieldSchemas,
  ForensicsRuntimeProofSchema,
  ForensicsResultSchema,
  ForensicsRecordEnvelopeSchema,
  StoredForensicsRecordSchema,
  ForensicsRecordQuerySchema,
  ForensicsAbilityInputBaseSchema,
};

export type {
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
};