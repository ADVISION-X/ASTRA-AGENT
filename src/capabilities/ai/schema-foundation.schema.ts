import { z } from "zod";

import { EvidenceRefSchema } from "../../types/evidence.js";
import {
  VisionPagePreparationPayloadSchema,
  VisionPagePreparationRequestInputSchema,
} from "../../types/vision-page-preparation.js";
import {
  VisionProductPresenceMissingFrameSchema,
  VisionProductPresencePayloadSchema,
  VisionProductPresenceRequestInputSchema,
} from "../../types/vision-product-presence.js";
import { VisionNextItemTargetCandidatePayloadSchema } from "../../types/vision-next-item-target-candidate.js";
import { VisionCommentsEntryTargetCandidatePayloadSchema } from "../../types/vision-comments-entry-target-candidate.js";
import { VisionNextItemAdvancedPayloadSchema } from "../../types/vision-next-item-advanced.js";
import {
  DEFAULT_AI_COST_POLICY,
  DEFAULT_AI_DATA_POLICY,
  DEFAULT_AI_PROVIDER_POLICY,
  DEFAULT_AI_QUALITY_POLICY,
  DEFAULT_AI_SAFETY_POLICY,
} from "./shared/ai-policy.js";
import {
  AI_ABILITY_GROUP_ID,
  AI_CHILD_CAPABILITY_IDS,
  AI_CHILD_CAPABILITY_STATUSES,
  AI_COST_POLICY_DECISIONS,
  AI_DATA_POLICY_DECISIONS,
  AI_DISABLED_PROVIDER_DECISIONS,
  AI_EXECUTION_STATUSES,
  AI_INPUT_MODALITIES,
  AI_MODEL_ROLES,
  AI_OUTPUT_AUTHORITIES,
  AI_OUTPUT_BOUNDARY_DECISIONS,
  AI_PROVIDER_KINDS,
  AI_PROVIDER_POLICY_DECISIONS,
  AI_QUALITY_DECISIONS,
  AI_SAFETY_POLICY_DECISIONS,
  AI_SCHEMA_DECISIONS,
  AI_SCHEMA_VALIDATION_STATUSES,
  AI_TASK_TYPES,
} from "./shared/ai-types.js";
import { AiChainFieldSchemas } from "./schema-chain-fields.js";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeNumber = z.number().finite().nonnegative();

const MAX_AI_INPUT_REFS = 50;
const MAX_AI_FRAME_REFS = 10;
const MAX_AI_COMMENT_BLOCKS = 200;
const MAX_AI_COMMENT_LENGTH = 1000;
const MAX_AI_PACKET_SUMMARY_LENGTH = 5000;
const MAX_AI_NOTES = 50;
const MAX_AI_NOTE_LENGTH = 500;
const MAX_AI_SHORT_TEXT = 1000;

const AiAbilityGroupIdSchema = z.literal(AI_ABILITY_GROUP_ID);
const AiChildCapabilityIdSchema = z.enum(AI_CHILD_CAPABILITY_IDS);
const AiTaskTypeSchema = z.enum(AI_TASK_TYPES);
const AiProviderKindSchema = z.enum(AI_PROVIDER_KINDS);
const AiExecutionStatusSchema = z.enum(AI_EXECUTION_STATUSES);
const AiInputModalitySchema = z.enum(AI_INPUT_MODALITIES);
const AiModelRoleSchema = z.enum(AI_MODEL_ROLES);
const AiSchemaValidationStatusSchema = z.enum(AI_SCHEMA_VALIDATION_STATUSES);
const AiOutputAuthoritySchema = z.enum(AI_OUTPUT_AUTHORITIES);
const AiChildCapabilityStatusSchema = z.enum(AI_CHILD_CAPABILITY_STATUSES);
const AiRequestSourceSchema = z.enum(["orchestration", "commander-console"]);
const AiTransportSourceSchema = z.enum(["nerve-bus", "commander-console"]);

const AiProviderDecisionSchema = z.enum(AI_PROVIDER_POLICY_DECISIONS);
const AiDataPolicyDecisionSchema = z.enum(AI_DATA_POLICY_DECISIONS);
const AiCostPolicyDecisionSchema = z.enum(AI_COST_POLICY_DECISIONS);
const AiSafetyPolicyDecisionSchema = z.enum(AI_SAFETY_POLICY_DECISIONS);
const AiSchemaDecisionSchema = z.enum(AI_SCHEMA_DECISIONS);
const AiQualityDecisionSchema = z.enum(AI_QUALITY_DECISIONS);
const AiOutputBoundaryDecisionSchema = z.enum(AI_OUTPUT_BOUNDARY_DECISIONS);
const AiDisabledProviderDecisionSchema = z.enum(AI_DISABLED_PROVIDER_DECISIONS);

const AiProviderPolicySchema = z.object({
  requireLocalOnly: z.boolean().default(DEFAULT_AI_PROVIDER_POLICY.requireLocalOnly),
  allowPaidProvider: z.boolean().default(DEFAULT_AI_PROVIDER_POLICY.allowPaidProvider),
  providerAllowlist: z.array(AiChildCapabilityIdSchema).default([...DEFAULT_AI_PROVIDER_POLICY.providerAllowlist]),
  operatorApprovalRef: nullableString,
  providerConfigRef: nullableString,
  secretRef: nullableString,
}).strict();

const AiDataPolicySchema = z.object({
  allowExternalTransmission: z.boolean().default(DEFAULT_AI_DATA_POLICY.allowExternalTransmission),
  redactSensitiveData: z.boolean().default(DEFAULT_AI_DATA_POLICY.redactSensitiveData),
}).strict();

const AiCostPolicySchema = z.object({
  maxEstimatedCost: nonNegativeNumber.nullable().default(DEFAULT_AI_COST_POLICY.maxEstimatedCost),
}).strict();

const AiQualityPolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1).nullable().default(DEFAULT_AI_QUALITY_POLICY.minimumConfidence),
  requireSchemaValidation: z.boolean().default(DEFAULT_AI_QUALITY_POLICY.requireSchemaValidation),
}).strict();

const AiSafetyPolicySchema = z.object({
  reviewOnLowConfidence: z.boolean().default(DEFAULT_AI_SAFETY_POLICY.reviewOnLowConfidence),
  reviewOnSchemaFailure: z.boolean().default(DEFAULT_AI_SAFETY_POLICY.reviewOnSchemaFailure),
  reviewOnPolicyViolation: z.boolean().default(DEFAULT_AI_SAFETY_POLICY.reviewOnPolicyViolation),
}).strict();

const AiPromptContractSchema = z.object({
  taskType: AiTaskTypeSchema,
  modelRole: AiModelRoleSchema,
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  purpose: z.string().min(1),
  forbiddenOutputs: z.array(z.string().min(1)).default([]),
}).strict();

const AiVisionRequestInputSchema = VisionProductPresenceRequestInputSchema.extend({
  frameEvidenceIds: z.array(z.string().min(1)).max(MAX_AI_FRAME_REFS).default([]),
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).max(MAX_AI_FRAME_REFS).default([]),
  summary: z.string().min(1).max(MAX_AI_PACKET_SUMMARY_LENGTH),
  tags: z.array(z.string().min(1).max(MAX_AI_SHORT_TEXT)).max(MAX_AI_NOTES).default([]),
}).strict();

const AiPagePreparationRequestInputSchema = VisionPagePreparationRequestInputSchema;

const AiOcrCleanupInputSchema = z.object({
  rawCommentBlocks: z.array(z.string().min(1).max(MAX_AI_COMMENT_LENGTH)).min(1).max(MAX_AI_COMMENT_BLOCKS),
}).strict();

const AiCommentSignalSummaryInputSchema = z.object({
  cleanedComments: z.array(z.string().min(1).max(MAX_AI_COMMENT_LENGTH)).min(1).max(MAX_AI_COMMENT_BLOCKS),
}).strict();

const AiCommentSignalSummaryOutputSchema = z.object({
  purchaseIntent: z.enum(["low", "medium", "high"]),
  painPoints: z.array(z.string().min(1)),
  complaints: z.array(z.string().min(1)),
  demandTerms: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
}).strict();

const AiOcrCleanupOutputSchema = z.object({
  cleanedComments: z.array(z.string().min(1)),
  uncertainText: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
}).strict();

const AiProductSignalSummaryInputSchema = z.object({
  videoSummary: z.string().min(1).max(MAX_AI_PACKET_SUMMARY_LENGTH),
  productPresence: VisionProductPresencePayloadSchema.omit({
    taskType: true,
    promptId: true,
    promptVersion: true,
    schemaVersion: true,
  }),
  commentSignals: AiCommentSignalSummaryOutputSchema,
}).strict();

const AiProductSignalSummaryOutputSchema = z.object({
  category: z.string().min(1),
  useCase: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)),
  painPoints: z.array(z.string().min(1)),
  purchaseIntent: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
}).strict();

const AiEvidencePacketAnalysisInputSchema = z.object({
  packetSummary: z.string().min(1).max(MAX_AI_PACKET_SUMMARY_LENGTH),
  evidenceIds: z.array(z.string().min(1)).min(1).max(MAX_AI_INPUT_REFS),
  notes: z.array(z.string().min(1).max(MAX_AI_NOTE_LENGTH)).max(MAX_AI_NOTES).default([]),
}).strict();

const AiEvidencePacketAnalysisOutputSchema = z.object({
  packetSummary: z.string().min(1).max(MAX_AI_PACKET_SUMMARY_LENGTH),
  evidenceIds: z.array(z.string().min(1)).min(1).max(MAX_AI_INPUT_REFS),
  notes: z.array(z.string().min(1).max(MAX_AI_NOTE_LENGTH)).max(MAX_AI_NOTES).default([]),
}).strict();

const AiSchemaValidationOnlyInputSchema = z.object({
  candidate: z.unknown(),
  sourceRef: nullableString,
  validationContextRef: nullableString,
}).strict().superRefine((value, context) => {
  if (value.sourceRef === null && value.validationContextRef === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "schema_validation_only requires sourceRef or validationContextRef",
      path: ["sourceRef"],
    });
  }
});

const AiSchemaValidationOnlyOutputSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string().min(1)).default([]),
}).strict();

const AiVisualOutputSchema = VisionProductPresencePayloadSchema.omit({
  taskType: true,
  promptId: true,
  promptVersion: true,
  schemaVersion: true,
}).strict();

const AiVisualTargetCandidateOutputSchema = z.union([
  VisionNextItemTargetCandidatePayloadSchema.omit({
    taskType: true,
    promptId: true,
    promptVersion: true,
    schemaVersion: true,
  }).strict(),
  VisionCommentsEntryTargetCandidatePayloadSchema.omit({
    taskType: true,
    promptId: true,
    promptVersion: true,
    schemaVersion: true,
  }).strict(),
]);

const AiPagePreparationOutputSchema = z.union([
  VisionPagePreparationPayloadSchema.omit({
    taskType: true,
    promptId: true,
    promptVersion: true,
    schemaVersion: true,
  }).strict(),
  VisionNextItemAdvancedPayloadSchema.omit({
    taskType: true,
    promptId: true,
    promptVersion: true,
    schemaVersion: true,
  }).strict(),
]);

const AiBaseInputSchema = z.object({
  abilityGroupId: AiAbilityGroupIdSchema.default(AI_ABILITY_GROUP_ID),
  missionId: z.string().min(1).nullable().default(null),
  inputRefs: z.array(EvidenceRefSchema).max(MAX_AI_INPUT_REFS),
  promptContractId: z.string().min(1),
  expectedOutputSchema: z.string().min(1),
  requestedBy: AiRequestSourceSchema,
  transportedBy: AiTransportSourceSchema,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  ...AiChainFieldSchemas,
  qualityPolicy: AiQualityPolicySchema.default(() => ({ ...DEFAULT_AI_QUALITY_POLICY })),
  providerPolicy: AiProviderPolicySchema.default(() => ({
    requireLocalOnly: DEFAULT_AI_PROVIDER_POLICY.requireLocalOnly,
    allowPaidProvider: DEFAULT_AI_PROVIDER_POLICY.allowPaidProvider,
    providerAllowlist: [...DEFAULT_AI_PROVIDER_POLICY.providerAllowlist],
    operatorApprovalRef: DEFAULT_AI_PROVIDER_POLICY.operatorApprovalRef,
    providerConfigRef: DEFAULT_AI_PROVIDER_POLICY.providerConfigRef,
    secretRef: DEFAULT_AI_PROVIDER_POLICY.secretRef,
  })),
  costPolicy: AiCostPolicySchema.default(() => ({ ...DEFAULT_AI_COST_POLICY })),
  dataPolicy: AiDataPolicySchema.default(() => ({ ...DEFAULT_AI_DATA_POLICY })),
  safetyPolicy: AiSafetyPolicySchema.default(() => ({ ...DEFAULT_AI_SAFETY_POLICY })),
}).strict();

const PagePreparationJudgmentInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("page_preparation_judgment"),
  inputModality: z.literal("image_collection"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiPagePreparationRequestInputSchema,
}).strict();

const ProductPresenceJudgmentInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("product_presence_judgment"),
  inputModality: z.literal("image_collection"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiVisionRequestInputSchema,
}).strict();

const VisualObservationInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("visual_observation"),
  inputModality: z.literal("image_collection"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiVisionRequestInputSchema,
}).strict();

const VisualTargetCandidateAnalysisInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("visual_target_candidate_analysis"),
  inputModality: z.literal("image_collection"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiVisionRequestInputSchema,
}).strict();

const OcrCleanupInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("ocr_cleanup"),
  inputModality: z.literal("text_blocks"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiOcrCleanupInputSchema,
}).strict();

const CommentSignalSummaryInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("comment_signal_summary"),
  inputModality: z.literal("text_blocks"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiCommentSignalSummaryInputSchema,
}).strict();

const ProductSignalSummaryInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("product_signal_summary"),
  inputModality: z.literal("structured_record"),
  inputRefs: z.array(EvidenceRefSchema).min(1).max(MAX_AI_INPUT_REFS),
  input: AiProductSignalSummaryInputSchema,
}).strict();

const EvidencePacketAnalysisInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("evidence_packet_analysis"),
  inputModality: z.literal("structured_record"),
  input: AiEvidencePacketAnalysisInputSchema,
}).strict();

const SchemaValidationOnlyInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("schema_validation_only"),
  inputModality: z.literal("structured_record"),
  input: AiSchemaValidationOnlyInputSchema,
}).strict();

const LocalVisionAiInputSchema = z.union([
  PagePreparationJudgmentInputSchema,
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
]);

const LocalTextAiInputSchema = z.union([
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
]);

const LocalOcrAiInputSchema = OcrCleanupInputSchema;
const InternalSchemaValidatorInputSchema = SchemaValidationOnlyInputSchema;
const PaidVisionAiInputSchema = z.union([
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
]);
const FutureApiAiInputSchema = z.never();

export {
  AiAbilityGroupIdSchema,
  AiChildCapabilityIdSchema,
  AiTaskTypeSchema,
  AiProviderKindSchema,
  AiExecutionStatusSchema,
  AiInputModalitySchema,
  AiModelRoleSchema,
  AiSchemaValidationStatusSchema,
  AiOutputAuthoritySchema,
  AiChildCapabilityStatusSchema,
  AiProviderDecisionSchema,
  AiDataPolicyDecisionSchema,
  AiCostPolicyDecisionSchema,
  AiSafetyPolicyDecisionSchema,
  AiSchemaDecisionSchema,
  AiQualityDecisionSchema,
  AiOutputBoundaryDecisionSchema,
  AiDisabledProviderDecisionSchema,
  AiProviderPolicySchema,
  AiDataPolicySchema,
  AiCostPolicySchema,
  AiQualityPolicySchema,
  AiSafetyPolicySchema,
  AiPromptContractSchema,
  AiVisionRequestInputSchema,
  AiPagePreparationRequestInputSchema,
  AiOcrCleanupInputSchema,
  AiCommentSignalSummaryInputSchema,
  AiCommentSignalSummaryOutputSchema,
  AiOcrCleanupOutputSchema,
  AiProductSignalSummaryInputSchema,
  AiProductSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisInputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiSchemaValidationOnlyInputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
  AiVisualTargetCandidateOutputSchema,
  AiBaseInputSchema,
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  SchemaValidationOnlyInputSchema,
  LocalVisionAiInputSchema,
  AiPagePreparationOutputSchema,
  LocalTextAiInputSchema,
  LocalOcrAiInputSchema,
  PagePreparationJudgmentInputSchema,
  InternalSchemaValidatorInputSchema,
  PaidVisionAiInputSchema,
  FutureApiAiInputSchema,
};