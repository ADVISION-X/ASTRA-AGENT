import { z } from "zod";

import { EvidenceRefSchema } from "../../types/evidence.js";
import { VisionProductPresencePayloadSchema, VisionProductPresenceRequestInputSchema } from "../../types/vision-product-presence.js";
import { DEFAULT_AI_COST_POLICY, DEFAULT_AI_DATA_POLICY, DEFAULT_AI_PROVIDER_POLICY, DEFAULT_AI_QUALITY_POLICY, DEFAULT_AI_SAFETY_POLICY } from "./shared/ai-policy.js";
import {
  AI_ABILITY_GROUP_ID,
  AI_CHILD_CAPABILITY_IDS,
  AI_CHILD_CAPABILITY_STATUSES,
  AI_EXECUTION_STATUSES,
  AI_INPUT_MODALITIES,
  AI_MODEL_ROLES,
  AI_OUTPUT_AUTHORITIES,
  AI_PROVIDER_KINDS,
  AI_SCHEMA_VALIDATION_STATUSES,
  AI_TASK_TYPES,
  AI_PROVIDER_POLICY_DECISIONS,
  AI_DATA_POLICY_DECISIONS,
  AI_COST_POLICY_DECISIONS,
  AI_SAFETY_POLICY_DECISIONS,
  AI_SCHEMA_DECISIONS,
  AI_QUALITY_DECISIONS,
  AI_OUTPUT_BOUNDARY_DECISIONS,
  AI_DISABLED_PROVIDER_DECISIONS,
} from "./shared/ai-types.js";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeNumber = z.number().finite().nonnegative();

export const AiAbilityGroupIdSchema = z.literal(AI_ABILITY_GROUP_ID);
export const AiChildCapabilityIdSchema = z.enum(AI_CHILD_CAPABILITY_IDS);
export const AiTaskTypeSchema = z.enum(AI_TASK_TYPES);
export const AiProviderKindSchema = z.enum(AI_PROVIDER_KINDS);
export const AiExecutionStatusSchema = z.enum(AI_EXECUTION_STATUSES);
export const AiInputModalitySchema = z.enum(AI_INPUT_MODALITIES);
export const AiModelRoleSchema = z.enum(AI_MODEL_ROLES);
export const AiSchemaValidationStatusSchema = z.enum(AI_SCHEMA_VALIDATION_STATUSES);
export const AiOutputAuthoritySchema = z.enum(AI_OUTPUT_AUTHORITIES);
export const AiChildCapabilityStatusSchema = z.enum(AI_CHILD_CAPABILITY_STATUSES);

export const AiProviderDecisionSchema = z.enum(AI_PROVIDER_POLICY_DECISIONS);
export const AiDataPolicyDecisionSchema = z.enum(AI_DATA_POLICY_DECISIONS);
export const AiCostPolicyDecisionSchema = z.enum(AI_COST_POLICY_DECISIONS);
export const AiSafetyPolicyDecisionSchema = z.enum(AI_SAFETY_POLICY_DECISIONS);
export const AiSchemaDecisionSchema = z.enum(AI_SCHEMA_DECISIONS);
export const AiQualityDecisionSchema = z.enum(AI_QUALITY_DECISIONS);
export const AiOutputBoundaryDecisionSchema = z.enum(AI_OUTPUT_BOUNDARY_DECISIONS);
export const AiDisabledProviderDecisionSchema = z.enum(AI_DISABLED_PROVIDER_DECISIONS);

export const AiProviderPolicySchema = z.object({
  requireLocalOnly: z.boolean().default(DEFAULT_AI_PROVIDER_POLICY.requireLocalOnly),
  allowPaidProvider: z.boolean().default(DEFAULT_AI_PROVIDER_POLICY.allowPaidProvider),
  providerAllowlist: z.array(AiChildCapabilityIdSchema).default([...DEFAULT_AI_PROVIDER_POLICY.providerAllowlist]),
  operatorApprovalRef: nullableString,
}).strict();

export const AiDataPolicySchema = z.object({
  allowExternalTransmission: z.boolean().default(DEFAULT_AI_DATA_POLICY.allowExternalTransmission),
  redactSensitiveData: z.boolean().default(DEFAULT_AI_DATA_POLICY.redactSensitiveData),
}).strict();

export const AiCostPolicySchema = z.object({
  maxEstimatedCost: nonNegativeNumber.nullable().default(DEFAULT_AI_COST_POLICY.maxEstimatedCost),
}).strict();

export const AiQualityPolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1).nullable().default(DEFAULT_AI_QUALITY_POLICY.minimumConfidence),
  requireSchemaValidation: z.boolean().default(DEFAULT_AI_QUALITY_POLICY.requireSchemaValidation),
}).strict();

export const AiSafetyPolicySchema = z.object({
  reviewOnLowConfidence: z.boolean().default(DEFAULT_AI_SAFETY_POLICY.reviewOnLowConfidence),
  reviewOnSchemaFailure: z.boolean().default(DEFAULT_AI_SAFETY_POLICY.reviewOnSchemaFailure),
  reviewOnPolicyViolation: z.boolean().default(DEFAULT_AI_SAFETY_POLICY.reviewOnPolicyViolation),
}).strict();

export const AiPromptContractSchema = z.object({
  taskType: AiTaskTypeSchema,
  modelRole: AiModelRoleSchema,
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  purpose: z.string().min(1),
  forbiddenOutputs: z.array(z.string().min(1)).default([]),
}).strict();

export const AiOcrCleanupInputSchema = z.object({
  rawCommentBlocks: z.array(z.string()),
}).strict();

export const AiCommentSignalSummaryInputSchema = z.object({
  cleanedComments: z.array(z.string().min(1)).min(1),
}).strict();

export const AiCommentSignalSummaryOutputSchema = z.object({
  purchaseIntent: z.enum(["low", "medium", "high"]),
  painPoints: z.array(z.string().min(1)),
  complaints: z.array(z.string().min(1)),
  demandTerms: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
}).strict();

export const AiOcrCleanupOutputSchema = z.object({
  cleanedComments: z.array(z.string().min(1)),
  uncertainText: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
}).strict();

export const AiProductSignalSummaryInputSchema = z.object({
  videoSummary: z.string().min(1),
  productPresence: VisionProductPresencePayloadSchema.omit({
    taskType: true,
    promptId: true,
    promptVersion: true,
    schemaVersion: true,
  }),
  commentSignals: AiCommentSignalSummaryOutputSchema,
}).strict();

export const AiProductSignalSummaryOutputSchema = z.object({
  category: z.string().min(1),
  useCase: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)),
  painPoints: z.array(z.string().min(1)),
  purchaseIntent: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
}).strict();

export const AiEvidencePacketAnalysisInputSchema = z.object({
  packetSummary: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string().min(1)).default([]),
}).strict();

export const AiEvidencePacketAnalysisOutputSchema = z.object({
  summary: z.string().min(1),
  notableEvidenceRefs: z.array(z.string().min(1)).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
}).strict();

export const AiSchemaValidationOnlyInputSchema = z.object({
  candidate: z.unknown(),
}).strict();

export const AiSchemaValidationOnlyOutputSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string().min(1)).default([]),
}).strict();

export const AiVisualOutputSchema = VisionProductPresencePayloadSchema.omit({
  taskType: true,
  promptId: true,
  promptVersion: true,
  schemaVersion: true,
}).strict();

const AiBaseInputSchema = z.object({
  abilityGroupId: AiAbilityGroupIdSchema.default(AI_ABILITY_GROUP_ID),
  missionId: z.string().min(1).nullable().default(null),
  inputRefs: z.array(EvidenceRefSchema),
  promptContractId: z.string().min(1),
  expectedOutputSchema: z.string().min(1),
  requestedBy: z.literal("orchestration"),
  transportedBy: z.literal("nerve-bus"),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  qualityPolicy: AiQualityPolicySchema.default(() => ({ ...DEFAULT_AI_QUALITY_POLICY })),
  providerPolicy: AiProviderPolicySchema.default(() => ({
    requireLocalOnly: DEFAULT_AI_PROVIDER_POLICY.requireLocalOnly,
    allowPaidProvider: DEFAULT_AI_PROVIDER_POLICY.allowPaidProvider,
    providerAllowlist: [...DEFAULT_AI_PROVIDER_POLICY.providerAllowlist],
    operatorApprovalRef: DEFAULT_AI_PROVIDER_POLICY.operatorApprovalRef,
  })),
  costPolicy: AiCostPolicySchema.default(() => ({ ...DEFAULT_AI_COST_POLICY })),
  dataPolicy: AiDataPolicySchema.default(() => ({ ...DEFAULT_AI_DATA_POLICY })),
  safetyPolicy: AiSafetyPolicySchema.default(() => ({ ...DEFAULT_AI_SAFETY_POLICY })),
}).strict();

export const ProductPresenceJudgmentInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("product_presence_judgment"),
  inputModality: z.literal("image_collection"),
  input: VisionProductPresenceRequestInputSchema,
}).strict();

export const VisualObservationInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("visual_observation"),
  inputModality: z.literal("image_collection"),
  input: VisionProductPresenceRequestInputSchema,
}).strict();

export const VisualTargetCandidateAnalysisInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("visual_target_candidate_analysis"),
  inputModality: z.literal("image_collection"),
  input: VisionProductPresenceRequestInputSchema,
}).strict();

export const OcrCleanupInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("ocr_cleanup"),
  inputModality: z.literal("text_blocks"),
  input: AiOcrCleanupInputSchema,
}).strict();

export const CommentSignalSummaryInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("comment_signal_summary"),
  inputModality: z.literal("text_blocks"),
  input: AiCommentSignalSummaryInputSchema,
}).strict();

export const ProductSignalSummaryInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("product_signal_summary"),
  inputModality: z.literal("structured_record"),
  input: AiProductSignalSummaryInputSchema,
}).strict();

export const EvidencePacketAnalysisInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("evidence_packet_analysis"),
  inputModality: z.literal("structured_record"),
  input: AiEvidencePacketAnalysisInputSchema,
}).strict();

export const SchemaValidationOnlyInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("schema_validation_only"),
  inputModality: z.literal("structured_record"),
  input: AiSchemaValidationOnlyInputSchema,
}).strict();

export const AiInputSchema = z.discriminatedUnion("taskType", [
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  SchemaValidationOnlyInputSchema,
]);

export const LocalVisionAiInputSchema = z.union([
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
]);

export const LocalTextAiInputSchema = z.union([
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
]);

export const LocalOcrAiInputSchema = OcrCleanupInputSchema;
export const InternalSchemaValidatorInputSchema = SchemaValidationOnlyInputSchema;
export const PaidVisionAiInputSchema = z.union([
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
]);
export const PaidAnalysisAiInputSchema = EvidencePacketAnalysisInputSchema;
export const FutureApiAiInputSchema = z.never();

const AiBaseRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1).nullable(),
  missionIdSource: z.enum(["explicit", "unavailable"]),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: AiAbilityGroupIdSchema,
  childCapabilityId: AiChildCapabilityIdSchema,
  taskType: AiTaskTypeSchema,
  promptContractId: z.string().min(1),
  expectedOutputSchema: z.string().min(1),
  modelProvider: AiProviderKindSchema,
  modelName: z.string().min(1),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  inputRefs: z.array(z.string().min(1)),
  outputRefs: z.array(z.string().min(1)),
  evidenceRefs: z.array(z.string().min(1)),
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
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clockPortKind: z.literal("system-monotonic-clock"),
}).strict();

export const AiRuntimeProofSchema = AiBaseRuntimeProofSchema.superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success" && (value.failureReason !== null || value.reviewRequiredReason !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof must not carry failure or review reasons", path: ["status"] });
  }
  if (value.status === "failed" && value.failureReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed proof requires failureReason", path: ["failureReason"] });
  }
  if (value.status === "review_required" && value.reviewRequiredReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "review_required proof requires reviewRequiredReason", path: ["reviewRequiredReason"] });
  }
});

export const AiRuntimeExecutionOutputSchema = z.object({
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
}).strict();

export const AiForbiddenActionOutputFieldSchema = z.object({
  actionIntent: z.never().optional(),
  action_intent: z.never().optional(),
  platformAction: z.never().optional(),
  platform_action: z.never().optional(),
  executableCoordinate: z.never().optional(),
  executable_coordinate: z.never().optional(),
  clickCommand: z.never().optional(),
  click_command: z.never().optional(),
  scrollCommand: z.never().optional(),
  scroll_command: z.never().optional(),
  openCommand: z.never().optional(),
  open_command: z.never().optional(),
  forensicsWriteCommand: z.never().optional(),
  mouseAction: z.never().optional(),
  mouse_click: z.never().optional(),
  browserAction: z.never().optional(),
  browser_open: z.never().optional(),
  pageAction: z.never().optional(),
  commandToExecute: z.never().optional(),
  coordinateToClick: z.never().optional(),
}).catchall(z.unknown()).superRefine((value, context) => {
  const forbiddenKeys = [
    "actionIntent",
    "action_intent",
    "platformAction",
    "platform_action",
    "executableCoordinate",
    "executable_coordinate",
    "clickCommand",
    "click_command",
    "scrollCommand",
    "scroll_command",
    "openCommand",
    "open_command",
    "forensicsWriteCommand",
    "mouseAction",
    "mouse_click",
    "browserAction",
    "browser_open",
    "pageAction",
    "commandToExecute",
    "coordinateToClick",
  ];
  for (const key of forbiddenKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `forbidden action output field: ${key}`, path: [key] });
    }
  }
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

export const ProductPresenceJudgmentResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("product_presence_judgment"),
  output: AiVisualOutputSchema,
}).strict();

export const VisualObservationResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("visual_observation"),
  output: AiVisualOutputSchema,
}).strict();

export const VisualTargetCandidateAnalysisResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("visual_target_candidate_analysis"),
  output: AiVisualOutputSchema,
}).strict();

export const OcrCleanupResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("ocr_cleanup"),
  output: AiOcrCleanupOutputSchema,
}).strict();

export const CommentSignalSummaryResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("comment_signal_summary"),
  output: AiCommentSignalSummaryOutputSchema,
}).strict();

export const ProductSignalSummaryResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("product_signal_summary"),
  output: AiProductSignalSummaryOutputSchema,
}).strict();

export const EvidencePacketAnalysisResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("evidence_packet_analysis"),
  output: AiEvidencePacketAnalysisOutputSchema,
}).strict();

export const SchemaValidationOnlyResultSchema = AiBaseResultSchema.extend({
  taskType: z.literal("schema_validation_only"),
  output: AiSchemaValidationOnlyOutputSchema,
}).strict();

export const AiResultSchema = z.discriminatedUnion("taskType", [
  ProductPresenceJudgmentResultSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
  OcrCleanupResultSchema,
  CommentSignalSummaryResultSchema,
  ProductSignalSummaryResultSchema,
  EvidencePacketAnalysisResultSchema,
  SchemaValidationOnlyResultSchema,
]).superRefine((value, context) => {
  if (value.reviewRequiredReason !== null && value.status !== "review_required") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "reviewRequiredReason requires review_required status", path: ["reviewRequiredReason"] });
  }
  if (value.status === "failed" && value.failureReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed result requires failureReason", path: ["failureReason"] });
  }
  if (value.status === "review_required" && value.reviewRequiredReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "review_required result requires reviewRequiredReason", path: ["reviewRequiredReason"] });
  }
  if (value.status === "success" && value.outputAuthority !== "authoritative") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result must be authoritative", path: ["outputAuthority"] });
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must match result.status", path: ["runtimeProof", "status"] });
  }
});

export const AiDispatchFailureEnvelopeSchema = z.object({
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

export const AiAbilityOutcomeSchema = z.union([AiResultSchema, AiDispatchFailureEnvelopeSchema]);

export const LocalVisionAiResultSchema = z.union([
  ProductPresenceJudgmentResultSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
]);

export const LocalTextAiResultSchema = z.union([
  CommentSignalSummaryResultSchema,
  ProductSignalSummaryResultSchema,
]);

export const LocalOcrAiResultSchema = OcrCleanupResultSchema;
export const InternalSchemaValidatorResultSchema = SchemaValidationOnlyResultSchema;
export const PaidVisionAiResultSchema = z.union([
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
]);
export const PaidAnalysisAiResultSchema = EvidencePacketAnalysisResultSchema;

export const AiChildReadinessSchema = z.object({
  abilityGroupId: AiAbilityGroupIdSchema,
  childCapabilityId: AiChildCapabilityIdSchema,
  providerKind: AiProviderKindSchema,
  status: AiChildCapabilityStatusSchema,
  supportedTaskTypes: z.array(AiTaskTypeSchema),
  detail: z.string().min(1),
  enabledByPolicy: z.boolean(),
}).strict();

export const AiRuntimeHealthSchema = z.object({
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

export const AiModelRosterEntrySchema = z.object({
  childCapabilityId: AiChildCapabilityIdSchema,
  providerKind: AiProviderKindSchema,
  taskTypes: z.array(AiTaskTypeSchema),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  modelOrTool: z.string().min(1).nullable(),
  enabledByPolicy: z.boolean(),
  status: z.enum(["configured", "placeholder", "disabled_by_policy"]),
}).strict();

export const AiModelRosterSchema = z.object({
  generatedAt: z.string().datetime(),
  entries: z.array(AiModelRosterEntrySchema),
  proof: z.object({
    generatedAt: z.string().datetime(),
    clockPortKind: z.literal("system-monotonic-clock"),
    entryCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const AiHealthReportSchema = z.object({
  ok: z.boolean(),
  detail: z.string().min(1),
  health: AiRuntimeHealthSchema,
  childStatuses: z.array(AiChildReadinessSchema),
}).strict();

export function parseAiInput(input: unknown) {
  return AiInputSchema.safeParse(input);
}

export function parseAiResult(input: unknown) {
  return AiResultSchema.safeParse(input);
}

export function parseAiAbilityOutcome(input: unknown) {
  return AiAbilityOutcomeSchema.safeParse(input);
}
