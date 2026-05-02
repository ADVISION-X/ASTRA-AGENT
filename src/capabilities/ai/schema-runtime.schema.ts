import { z } from "zod";

import { EvidenceRefSchema } from "../../types/evidence.js";
import {
  AiAbilityGroupIdSchema,
  AiChildCapabilityIdSchema,
  AiChildCapabilityStatusSchema,
  AiCommentSignalSummaryOutputSchema,
  AiCostPolicyDecisionSchema,
  AiDataPolicyDecisionSchema,
  AiDisabledProviderDecisionSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiExecutionStatusSchema,
  AiModelRoleSchema,
  AiOcrCleanupOutputSchema,
  AiOutputAuthoritySchema,
  AiOutputBoundaryDecisionSchema,
  AiProductSignalSummaryOutputSchema,
  AiProviderDecisionSchema,
  AiProviderKindSchema,
  AiQualityDecisionSchema,
  AiSafetyPolicyDecisionSchema,
  AiSchemaDecisionSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiSchemaValidationStatusSchema,
  AiTaskTypeSchema,
  AiVisualOutputSchema,
} from "./schema-core.schema.js";
import { AiForbiddenActionOutputFieldSchema } from "./schema-runtime-output-boundary.schema.js";
import {
  validateAiResultSuccessInvariants,
  validateAiRuntimeExecutionOutputSuccessInvariants,
  validateAiRuntimeProofSuccessInvariants,
} from "./schema-runtime-success-invariants.js";
import { AiRuntimeProofChainFieldSchemas } from "./schema-chain-fields.js";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeNumber = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();
const CircuitBreakerStateSchema = z.enum(["closed", "open", "half_open", "not_applicable"]);

const AiBaseRuntimeProofFieldSchemas = {
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1).nullable(),
  missionIdSource: z.enum(["explicit", "unavailable"]),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  ...AiRuntimeProofChainFieldSchemas,
  abilityGroupId: AiAbilityGroupIdSchema,
  childCapabilityId: AiChildCapabilityIdSchema,
  taskType: AiTaskTypeSchema,
  promptContractId: z.string().min(1),
  expectedOutputSchema: z.string().min(1),
  modelProvider: AiProviderKindSchema,
  modelName: z.string().min(1),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  requestHash: z.string().min(1),
  inputPayloadHash: z.string().min(1),
  promptContractHash: z.string().min(1),
  modelConfigHash: z.string().min(1),
  runtimeCallId: nullableString,
  inputRefs: z.array(z.string().min(1)),
  outputRefs: z.array(z.string().min(1)),
  evidenceRefs: z.array(z.string().min(1)),
  rawOutputRef: nullableString,
  rawOutputHash: nullableString,
  runLockId: nullableString,
  cancellationTokenRef: nullableString,
  resumeCheckpointRef: nullableString,
  timeoutMs: nonNegativeNumber.nullable(),
  attemptIndex: nonNegativeInteger,
  retryCount: nonNegativeInteger,
  maxRetry: nonNegativeInteger.default(0),
  circuitBreakerState: CircuitBreakerStateSchema,
  gatewayDurationMs: nonNegativeNumber.nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeNumber,
  status: AiExecutionStatusSchema,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  providerDecision: AiProviderDecisionSchema,
  dataPolicyDecision: AiDataPolicyDecisionSchema,
  costPolicyDecision: AiCostPolicyDecisionSchema,
  safetyPolicyDecision: AiSafetyPolicyDecisionSchema,
  schemaDecision: AiSchemaDecisionSchema,
  qualityDecision: AiQualityDecisionSchema,
  outputBoundaryDecision: AiOutputBoundaryDecisionSchema,
  disabledProviderDecision: AiDisabledProviderDecisionSchema,
  schemaIssueCount: nonNegativeInteger,
  boundaryViolationCount: nonNegativeInteger,
  qualityDecisionReason: nullableString,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clockPortKind: z.literal("system-monotonic-clock"),
};

const AiBaseRuntimeProofSchema = z.object(AiBaseRuntimeProofFieldSchemas).strict();

const validateAiRuntimeProofOrder = (
  value: z.infer<typeof AiBaseRuntimeProofSchema>,
  context: z.RefinementCtx,
) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
};

const validateAiRuntimeProofStatus = (
  value: z.infer<typeof AiBaseRuntimeProofSchema>,
  context: z.RefinementCtx,
) => {
  if (value.status === "success" && (value.failureReason !== null || value.reviewRequiredReason !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof must not carry failure or review reasons", path: ["status"] });
  }
  if (value.status === "failed" && value.failureReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed proof requires failureReason", path: ["failureReason"] });
  }
  if (value.status === "review_required" && value.reviewRequiredReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "review_required proof requires reviewRequiredReason", path: ["reviewRequiredReason"] });
  }
  validateAiRuntimeProofSuccessInvariants(value, context);
};

const AiRuntimeProofSchema = AiBaseRuntimeProofSchema.superRefine((value, context) => {
  validateAiRuntimeProofOrder(value, context);
  validateAiRuntimeProofStatus(value, context);
});

const AiRuntimeExecutionOutputSchema = z.object({
  modelProvider: AiProviderKindSchema,
  modelName: z.string().min(1),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  implementationStatus: z.string().min(1),
  createdAt: z.string().datetime().nullable().default(null),
  confidence: z.number().min(0).max(1).nullable(),
  costEstimate: nonNegativeNumber.nullable(),
  output: z.unknown(),
  rawOutputRef: nullableString,
  rawOutputHash: nullableString,
  runtimeCallId: nullableString,
  timeoutMs: nonNegativeNumber.nullable(),
  attemptIndex: nonNegativeInteger.default(0),
  retryCount: nonNegativeInteger.default(0),
  circuitBreakerState: CircuitBreakerStateSchema.default("not_applicable"),
  gatewayDurationMs: nonNegativeNumber.nullable().default(null),
  modelHealthBefore: nullableString,
  modelHealthAfter: nullableString,
}).strict().superRefine((value, context) => {
  validateAiRuntimeExecutionOutputSuccessInvariants(value, context);
});

const AiBaseResultSchema = z.object({
  status: AiExecutionStatusSchema,
  abilityGroupId: AiAbilityGroupIdSchema,
  childCapabilityId: AiChildCapabilityIdSchema,
  taskType: AiTaskTypeSchema,
  modelProvider: AiProviderKindSchema,
  modelName: z.string().min(1),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  implementationStatus: z.string().min(1),
  outputAuthority: AiOutputAuthoritySchema,
  rawOutputRef: nullableString,
  schemaValidationStatus: AiSchemaValidationStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  durationMs: nonNegativeNumber,
  costEstimate: nonNegativeNumber.nullable(),
  evidenceRefs: z.array(EvidenceRefSchema),
  debugLogRef: nullableString,
  runtimeProof: AiRuntimeProofSchema,
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  createdAt: z.string().datetime(),
}).strict();

function createAiSuccessResultSchema<TTaskType extends z.infer<typeof AiTaskTypeSchema>>(taskType: TTaskType, outputSchema: z.ZodTypeAny) {
  return AiBaseResultSchema.extend({
    taskType: z.literal(taskType),
    status: z.literal("success"),
    outputAuthority: z.literal("authoritative"),
    output: outputSchema,
    failureReason: z.null().default(null),
    reviewRequiredReason: z.null().default(null),
  }).strict();
}

function createAiFailedResultSchema<TTaskType extends z.infer<typeof AiTaskTypeSchema>>(taskType: TTaskType) {
  return AiBaseResultSchema.extend({
    taskType: z.literal(taskType),
    status: z.literal("failed"),
    outputAuthority: z.literal("non_authoritative"),
    output: z.null(),
    failureReason: z.string().min(1),
    reviewRequiredReason: z.null().default(null),
  }).strict();
}

function createAiReviewRequiredResultSchema<TTaskType extends z.infer<typeof AiTaskTypeSchema>>(taskType: TTaskType) {
  return AiBaseResultSchema.extend({
    taskType: z.literal(taskType),
    status: z.literal("review_required"),
    outputAuthority: z.literal("non_authoritative"),
    output: z.null(),
    failureReason: z.null().default(null),
    reviewRequiredReason: z.string().min(1),
  }).strict();
}

const ProductPresenceJudgmentResultSchema = z.union([
  createAiSuccessResultSchema("product_presence_judgment", AiVisualOutputSchema),
  createAiFailedResultSchema("product_presence_judgment"),
  createAiReviewRequiredResultSchema("product_presence_judgment"),
]);

const VisualObservationResultSchema = z.union([
  createAiSuccessResultSchema("visual_observation", AiVisualOutputSchema),
  createAiFailedResultSchema("visual_observation"),
  createAiReviewRequiredResultSchema("visual_observation"),
]);

const VisualTargetCandidateAnalysisResultSchema = z.union([
  createAiSuccessResultSchema("visual_target_candidate_analysis", AiVisualOutputSchema),
  createAiFailedResultSchema("visual_target_candidate_analysis"),
  createAiReviewRequiredResultSchema("visual_target_candidate_analysis"),
]);

const OcrCleanupResultSchema = z.union([
  createAiSuccessResultSchema("ocr_cleanup", AiOcrCleanupOutputSchema),
  createAiFailedResultSchema("ocr_cleanup"),
  createAiReviewRequiredResultSchema("ocr_cleanup"),
]);

const CommentSignalSummaryResultSchema = z.union([
  createAiSuccessResultSchema("comment_signal_summary", AiCommentSignalSummaryOutputSchema),
  createAiFailedResultSchema("comment_signal_summary"),
  createAiReviewRequiredResultSchema("comment_signal_summary"),
]);

const ProductSignalSummaryResultSchema = z.union([
  createAiSuccessResultSchema("product_signal_summary", AiProductSignalSummaryOutputSchema),
  createAiFailedResultSchema("product_signal_summary"),
  createAiReviewRequiredResultSchema("product_signal_summary"),
]);

const EvidencePacketAnalysisResultSchema = z.union([
  createAiSuccessResultSchema("evidence_packet_analysis", AiEvidencePacketAnalysisOutputSchema),
  createAiFailedResultSchema("evidence_packet_analysis"),
  createAiReviewRequiredResultSchema("evidence_packet_analysis"),
]);

const SchemaValidationOnlyResultSchema = z.union([
  createAiSuccessResultSchema("schema_validation_only", AiSchemaValidationOnlyOutputSchema),
  createAiFailedResultSchema("schema_validation_only"),
  createAiReviewRequiredResultSchema("schema_validation_only"),
]);

const validateAiResultState = (
  value: z.infer<typeof AiBaseResultSchema> & { output?: unknown },
  context: z.RefinementCtx,
) => {
  if (value.reviewRequiredReason !== null && value.status !== "review_required") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "reviewRequiredReason requires review_required status", path: ["reviewRequiredReason"] });
  }
  if (value.status === "failed" && value.failureReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed result requires failureReason", path: ["failureReason"] });
  }
  if (value.status === "review_required" && value.reviewRequiredReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "review_required result requires reviewRequiredReason", path: ["reviewRequiredReason"] });
  }
};

const validateAiResultOutput = (
  value: z.infer<typeof AiBaseResultSchema> & { output?: unknown },
  context: z.RefinementCtx,
) => {
  const output = value.output ?? null;
  if (value.status === "success" && value.outputAuthority !== "authoritative") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result must be authoritative", path: ["outputAuthority"] });
  }
  if (value.status !== "success" && output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required result output must be null", path: ["output"] });
  }
  if (value.status === "success" && value.confidence === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires confidence", path: ["confidence"] });
  }
  validateAiResultSuccessInvariants(value, context);
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must match result.status", path: ["runtimeProof", "status"] });
  }
};

const AiResultSchema = z.union([
  ProductPresenceJudgmentResultSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
  OcrCleanupResultSchema,
  CommentSignalSummaryResultSchema,
  ProductSignalSummaryResultSchema,
  EvidencePacketAnalysisResultSchema,
  SchemaValidationOnlyResultSchema,
]).superRefine((value, context) => {
  validateAiResultState(value, context);
  validateAiResultOutput(value, context);
});

const AiDispatchFailureEnvelopeSchema = z.object({
  status: z.literal("failed"),
  abilityGroupId: AiAbilityGroupIdSchema,
  failureKind: z.literal("dispatch_failure"),
  childCapabilityId: AiChildCapabilityIdSchema.nullable(),
  taskType: AiTaskTypeSchema.nullable(),
  rawInputRef: z.string().min(1),
  parseFailureReason: z.string().min(1),
  fallbackProof: z.object({
    proofId: z.string().min(1),
    runId: z.string().min(1),
    missionId: z.string().min(1).nullable(),
    missionIdSource: z.enum(["parsed_input", "unavailable"]),
    sessionId: z.string().min(1).nullable(),
    sessionIdSource: z.enum(["parsed_input", "unavailable"]),
    childCapabilityId: AiChildCapabilityIdSchema.nullable(),
    childCapabilityIdSource: z.enum(["parsed_route", "unavailable"]),
    taskType: AiTaskTypeSchema.nullable(),
    taskTypeSource: z.enum(["parsed_input", "unavailable"]),
    providerKind: AiProviderKindSchema.nullable(),
    providerKindSource: z.enum(["registry_contract", "unavailable"]),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    durationMs: nonNegativeNumber,
    status: z.literal("failed"),
    failureReason: z.string().min(1),
    clockPortKind: z.literal("system-monotonic-clock"),
  }).strict(),
  outputAuthority: z.literal("non_authoritative"),
  failureReason: z.string().min(1),
  reviewRequiredReason: nullableString,
  createdAt: z.string().datetime(),
}).strict();

const AiAbilityOutcomeSchema = z.union([AiResultSchema, AiDispatchFailureEnvelopeSchema]);

const LocalVisionAiResultSchema = z.union([
  ProductPresenceJudgmentResultSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
]);

const LocalTextAiResultSchema = z.union([
  CommentSignalSummaryResultSchema,
  ProductSignalSummaryResultSchema,
]);

const LocalOcrAiResultSchema = OcrCleanupResultSchema;
const InternalSchemaValidatorResultSchema = SchemaValidationOnlyResultSchema;
const PaidVisionAiResultSchema = z.union([
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
]);
const PaidAnalysisAiResultSchema = EvidencePacketAnalysisResultSchema;

const AiChildReadinessSchema = z.object({
  abilityGroupId: AiAbilityGroupIdSchema,
  childCapabilityId: AiChildCapabilityIdSchema,
  providerKind: AiProviderKindSchema,
  status: AiChildCapabilityStatusSchema,
  supportedTaskTypes: z.array(AiTaskTypeSchema),
  detail: z.string().min(1),
  enabledByPolicy: z.boolean(),
}).strict();

const AiRuntimeHealthSchema = z.object({
  overallStatus: z.enum(["ready", "degraded", "unavailable"]),
  implementationStatus: z.string().min(1),
  dependencies: z.object({
    gateway: z.string().min(1),
    vision: z.string().min(1),
    text: z.string().min(1),
    ocr: z.string().min(1),
  }).strict(),
  configuredModels: z.object({
    vision: z.string().min(1),
    commentUnderstanding: z.string().min(1),
    ocr: z.string().min(1),
    productSignal: z.string().min(1),
  }).strict(),
  availableModels: z.array(z.string().min(1)),
  lastCheckedAt: z.string().datetime(),
  failureReason: nullableString,
  lastTaskType: AiTaskTypeSchema.nullable().default(null),
  lastFailureReason: nullableString,
  lastInvocationStatus: nullableString,
}).strict();

const AiModelRosterEntrySchema = z.object({
  childCapabilityId: AiChildCapabilityIdSchema,
  providerKind: AiProviderKindSchema,
  taskTypes: z.array(AiTaskTypeSchema),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  modelOrTool: z.string().min(1).nullable(),
  enabledByPolicy: z.boolean(),
  status: z.enum(["configured", "placeholder", "disabled_by_policy"]),
}).strict();

const AiModelRosterSchema = z.object({
  generatedAt: z.string().datetime(),
  entries: z.array(AiModelRosterEntrySchema),
  proof: z.object({
    generatedAt: z.string().datetime(),
    clockPortKind: z.literal("system-monotonic-clock"),
    entryCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const AiHealthReportSchema = z.object({
  ok: z.boolean(),
  detail: z.string().min(1),
  health: AiRuntimeHealthSchema,
  childStatuses: z.array(AiChildReadinessSchema),
}).strict();

export {
  AiBaseRuntimeProofFieldSchemas,
  AiRuntimeProofSchema,
  AiRuntimeExecutionOutputSchema,
  AiForbiddenActionOutputFieldSchema,
  ProductPresenceJudgmentResultSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
  OcrCleanupResultSchema,
  CommentSignalSummaryResultSchema,
  ProductSignalSummaryResultSchema,
  EvidencePacketAnalysisResultSchema,
  SchemaValidationOnlyResultSchema,
  AiResultSchema,
  AiDispatchFailureEnvelopeSchema,
  AiAbilityOutcomeSchema,
  LocalVisionAiResultSchema,
  LocalTextAiResultSchema,
  LocalOcrAiResultSchema,
  InternalSchemaValidatorResultSchema,
  PaidVisionAiResultSchema,
  PaidAnalysisAiResultSchema,
  AiChildReadinessSchema,
  AiRuntimeHealthSchema,
  AiModelRosterEntrySchema,
  AiModelRosterSchema,
  AiHealthReportSchema,
};