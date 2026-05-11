import { z } from "zod";

import {
  AiAbilityGroupIdSchema,
  AiChildCapabilityIdSchema,
  AiChildCapabilityStatusSchema,
  AiCommentSignalSummaryInputSchema,
  AiCommentSignalSummaryOutputSchema,
  AiCostPolicyDecisionSchema,
  AiCostPolicySchema,
  AiDataPolicyDecisionSchema,
  AiDataPolicySchema,
  AiDisabledProviderDecisionSchema,
  AiEvidencePacketAnalysisInputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiExecutionStatusSchema,
  AiInputModalitySchema,
  AiModelRoleSchema,
  AiOcrCleanupInputSchema,
  AiOcrCleanupOutputSchema,
  AiPagePreparationOutputSchema,
  AiOutputAuthoritySchema,
  AiOutputBoundaryDecisionSchema,
  AiProductSignalSummaryInputSchema,
  AiProductSignalSummaryOutputSchema,
  AiPromptContractSchema,
  AiProviderDecisionSchema,
  AiProviderKindSchema,
  AiProviderPolicySchema,
  AiQualityDecisionSchema,
  AiQualityPolicySchema,
  AiSafetyPolicyDecisionSchema,
  AiSafetyPolicySchema,
  AiSchemaDecisionSchema,
  AiPagePreparationRequestInputSchema,
  AiVisionRequestInputSchema,
  AiSchemaValidationOnlyInputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiSchemaValidationStatusSchema,
  AiTaskTypeSchema,
  AiVisualOutputSchema,
  AiVisualTargetCandidateOutputSchema,
  CommentSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  FutureApiAiInputSchema,
  InternalSchemaValidatorInputSchema,
  LocalOcrAiInputSchema,
  LocalTextAiInputSchema,
  LocalVisionAiInputSchema,
  OcrCleanupInputSchema,
  PaidVisionAiInputSchema,
  PagePreparationJudgmentInputSchema,
  ProductPresenceJudgmentInputSchema,
  ProductSignalSummaryInputSchema,
  SchemaValidationOnlyInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
} from "./schema-foundation.schema.js";
import { AiChainFieldSchemas } from "./schema-chain-fields.js";

const AiCoreChainFieldSchema = z.object(AiChainFieldSchemas).strict();

function validateAiCoreChainFields(value: unknown, context: z.RefinementCtx) {
  if (!value || typeof value !== "object") {
    const parsed = AiCoreChainFieldSchema.safeParse(value);
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      context.addIssue(issue);
    }
    return;
  }
  const parsed = AiCoreChainFieldSchema.safeParse(
    Object.fromEntries(Object.keys(AiChainFieldSchemas).map((field) => [field, Reflect.get(value, field)])),
  );
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue(issue);
    }
  }
}

const AiInputSchema = z.discriminatedUnion("taskType", [
  PagePreparationJudgmentInputSchema,
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  SchemaValidationOnlyInputSchema,
]).superRefine((value, context) => {
  validateAiCoreChainFields(value, context);

  const expectedRequestedBy = "orchestration";
  const expectedTransportedBy = "nerve-bus";
  if (value.requestedBy !== expectedRequestedBy) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${value.taskType} requires requestedBy=${expectedRequestedBy}`,
      path: ["requestedBy"],
    });
  }
  if (value.transportedBy !== expectedTransportedBy) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${value.taskType} requires transportedBy=${expectedTransportedBy}`,
      path: ["transportedBy"],
    });
  }
});

const PaidAnalysisAiInputSchema = EvidencePacketAnalysisInputSchema;

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
  AiCommentSignalSummaryInputSchema,
  AiCommentSignalSummaryOutputSchema,
  AiOcrCleanupInputSchema,
  AiOcrCleanupOutputSchema,
  AiProductSignalSummaryInputSchema,
  AiProductSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisInputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiSchemaValidationOnlyInputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
  AiVisualTargetCandidateOutputSchema,
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  SchemaValidationOnlyInputSchema,
  AiInputSchema,
  AiPagePreparationOutputSchema,
  LocalVisionAiInputSchema,
  PagePreparationJudgmentInputSchema,
  LocalTextAiInputSchema,
  LocalOcrAiInputSchema,
  InternalSchemaValidatorInputSchema,
  PaidVisionAiInputSchema,
  PaidAnalysisAiInputSchema,
  FutureApiAiInputSchema,
};
