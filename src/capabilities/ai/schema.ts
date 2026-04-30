import { AiInputSchema } from "./schema-core.schema.js";
import {
  AiAbilityOutcomeSchema,
  AiHealthReportSchema,
  AiResultSchema,
  AiRuntimeProofSchema,
} from "./schema-runtime.schema.js";

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
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  SchemaValidationOnlyInputSchema,
  AiInputSchema,
  LocalVisionAiInputSchema,
  LocalTextAiInputSchema,
  LocalOcrAiInputSchema,
  InternalSchemaValidatorInputSchema,
  PaidVisionAiInputSchema,
  PaidAnalysisAiInputSchema,
  FutureApiAiInputSchema,
} from "./schema-core.schema.js";

export {
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
} from "./schema-runtime.schema.js";

export function parseAiInput(input: unknown) {
  return AiInputSchema.safeParse(input);
}

export function parseAiResult(input: unknown) {
  return AiResultSchema.safeParse(input);
}

export function parseAiAbilityOutcome(input: unknown) {
  return AiAbilityOutcomeSchema.safeParse(input);
}