import { z } from "zod";

const FORENSICS_PERSISTENCE_ABILITY_GROUP_ID = "forensics-persistence" as const;
const nullableString = z.string().min(1).nullable().default(null);
const nullableOptionalString = z.string().min(1).nullable().optional().default(null);
const nonNegativeInt = z.number().int().nonnegative();
const stringRefListSchema = z.array(z.string().min(1)).default([]);
const ForensicsPlainObjectSchema = z.record(z.string(), z.unknown());

const requiresPromptRefs = (recordType: string): boolean => recordType === "ai_result_record";
const requiresActionVerificationRefs = (recordType: string): boolean => recordType === "structured_action_log";
const requiresDecisionRef = (recordType: string): boolean => (
  recordType === "browse_ledger_entry"
  || recordType === "evidence_packet"
  || recordType === "failed_record"
);

const addMissingChainIssue = (ctx: z.RefinementCtx, path: string, message: string): void => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
};

const addPromptRefIssues = (input: {
  promptContractId?: string | null;
  promptContractVersion?: string | null;
  promptCatalogVersion?: string | null;
}, ctx: z.RefinementCtx): void => {
  if (!input.promptContractId) {
    addMissingChainIssue(ctx, "promptContractId", "AI records require promptContractId.");
  }
  if (!input.promptContractVersion) {
    addMissingChainIssue(ctx, "promptContractVersion", "AI records require promptContractVersion.");
  }
  if (!input.promptCatalogVersion) {
    addMissingChainIssue(ctx, "promptCatalogVersion", "AI records require promptCatalogVersion.");
  }
};

const addActionVerificationIssues = (input: {
  actionRef?: string | null;
  postActionVerificationRef?: string | null;
}, ctx: z.RefinementCtx): void => {
  if (!input.actionRef) {
    addMissingChainIssue(ctx, "actionRef", "Action records require actionRef.");
  }
  if (!input.postActionVerificationRef) {
    addMissingChainIssue(ctx, "postActionVerificationRef", "Action records require postActionVerificationRef.");
  }
};

function addConditionalChainRefIssues(input: {
  recordType: string;
  promptContractId?: string | null;
  promptContractVersion?: string | null;
  promptCatalogVersion?: string | null;
  actionRef?: string | null;
  postActionVerificationRef?: string | null;
  decisionRef?: string | null;
}, ctx: z.RefinementCtx): void {
  if (requiresPromptRefs(input.recordType)) {
    addPromptRefIssues(input, ctx);
  }

  if (requiresActionVerificationRefs(input.recordType)) {
    addActionVerificationIssues(input, ctx);
  }

  if (requiresDecisionRef(input.recordType) && !input.decisionRef) {
    addMissingChainIssue(ctx, "decisionRef", "Finalization records require decisionRef.");
  }
}

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
const ForensicsArtifactRetentionClassSchema = z.enum([
  "transient-capture",
  "transient-region",
  "transient-ai-input",
  "transient-contact-sheet",
  "diagnostic-debug",
  "promoted-evidence",
  "legal-hold-evidence",
]);
const ForensicsArtifactPromotionStatusSchema = z.enum([
  "not_promoted",
  "promotion_requested",
  "promoted",
  "legal_hold",
]);

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
  artifactLifecycleManifestRef: nullableString,
  retentionClass: ForensicsArtifactRetentionClassSchema.nullable().default(null),
  promotionStatus: ForensicsArtifactPromotionStatusSchema.default("not_promoted"),
  artifactHash: nullableString,
  byteSize: nonNegativeInt.nullable().default(null),
  promotedByRecordRef: ForensicsRecordRefSchema.nullable().default(null),
  pinnedByRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  legalHoldReason: nullableString,
  cleanupLedgerRef: nullableString,
  refCount: nonNegativeInt.default(0),
  cleanupEligible: z.boolean().default(false),
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
  stepId: z.string().min(1),
  mapPackageId: z.string().min(1),
  mapPackageVersion: z.string().min(1),
  selectedMapId: z.string().min(1),
  selectedMapVersion: z.string().min(1),
  activationSnapshotRef: z.string().min(1),
  capabilityCallId: z.string().min(1),
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
  inputRefs: stringRefListSchema,
  outputRefs: stringRefListSchema,
  inputRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  outputRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  parentRefs: z.array(ForensicsRecordRefSchema).default([]),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  storageRef: z.string().min(1).nullable().default(null),
  integrityHash: z.string().min(1).nullable().default(null),
  promptContractId: nullableString,
  promptContractVersion: nullableString,
  promptCatalogVersion: nullableString,
  actionRef: nullableString,
  postActionVerificationRef: nullableString,
  decisionRef: nullableString,
  policyDecision: ForensicsPolicyDecisionSchema,
  integrityDecision: ForensicsIntegrityDecisionSchema,
  failureReason: ForensicsFailureSchema.nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
};

const ForensicsRuntimeProofSchema = z.object(ForensicsRuntimeProofFieldSchemas).superRefine((value, ctx) => {
  addConditionalChainRefIssues(value, ctx);
  if (value.status === "success" && !value.integrityHash) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["integrityHash"], message: "Successful proofs require integrityHash." });
  }
  if (value.status === "review_required" && !value.reviewRequiredReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reviewRequiredReason"], message: "Review-required proofs require reviewRequiredReason." });
  }
});

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
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  stepId: z.string().min(1),
  mapPackageId: z.string().min(1),
  mapPackageVersion: z.string().min(1),
  selectedMapId: z.string().min(1),
  selectedMapVersion: z.string().min(1),
  activationSnapshotRef: z.string().min(1),
  capabilityCallId: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: z.unknown(),
  inputRefs: stringRefListSchema,
  outputRefs: stringRefListSchema,
  sourceRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  parentRefs: z.array(ForensicsRecordRefSchema).default([]),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  promptContractId: nullableString,
  promptContractVersion: nullableString,
  promptCatalogVersion: nullableString,
  actionRef: nullableString,
  postActionVerificationRef: nullableString,
  decisionRef: nullableString,
  schemaVersion: z.string().min(1),
  integrityHash: z.string().min(1),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  idempotencyKey: z.string().min(1),
}).superRefine((value, ctx) => {
  addConditionalChainRefIssues(value, ctx);
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
  missionId: nullableOptionalString,
  runId: nullableOptionalString,
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  stepId: nullableOptionalString,
  mapPackageId: nullableOptionalString,
  mapPackageVersion: nullableOptionalString,
  selectedMapId: nullableOptionalString,
  selectedMapVersion: nullableOptionalString,
  activationSnapshotRef: nullableOptionalString,
  capabilityCallId: nullableOptionalString,
  inputRefs: stringRefListSchema,
  outputRefs: stringRefListSchema,
  sourceRecordRefs: z.array(ForensicsRecordRefSchema).default([]),
  parentRefs: z.array(ForensicsRecordRefSchema).default([]),
  artifactRefs: z.array(ForensicsArtifactRefSchema).default([]),
  promptContractId: nullableOptionalString,
  promptContractVersion: nullableOptionalString,
  promptCatalogVersion: nullableOptionalString,
  actionRef: nullableOptionalString,
  postActionVerificationRef: nullableOptionalString,
  decisionRef: nullableOptionalString,
  persistencePolicy: ForensicsPersistencePolicySchema,
  integrityPolicy: ForensicsIntegrityPolicySchema.partial().optional(),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  existingRecordId: z.string().min(1).optional(),
  schemaVersion: z.string().min(1).optional(),
  debugLogRef: z.string().min(1).nullable().optional(),
});

type ForensicsArtifactRef = z.infer<typeof ForensicsArtifactRefSchema>;
type ForensicsArtifactPromotionStatus = z.infer<typeof ForensicsArtifactPromotionStatusSchema>;
type ForensicsArtifactRetentionClass = z.infer<typeof ForensicsArtifactRetentionClassSchema>;
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
type ForensicsStorageOperation = z.infer<typeof ForensicsStorageOperationSchema>;
type ForensicsRuntimeProof = z.infer<typeof ForensicsRuntimeProofSchema>;
type StoredForensicsRecord = z.infer<typeof StoredForensicsRecordSchema>;

export {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  ForensicsChildCapabilityIdSchema,
  ForensicsRecordTypeSchema,
  ForensicsArtifactTypeSchema,
  ForensicsArtifactRetentionClassSchema,
  ForensicsArtifactPromotionStatusSchema,
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
  ForensicsPlainObjectSchema,
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
  ForensicsArtifactPromotionStatus,
  ForensicsArtifactRetentionClass,
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
};