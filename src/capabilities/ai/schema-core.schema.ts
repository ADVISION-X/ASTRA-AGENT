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
  AiVisionRequestInputSchema,
  AiSchemaValidationOnlyInputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiSchemaValidationStatusSchema,
  AiTaskTypeSchema,
  AiVisualOutputSchema,
  CommentSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  FutureApiAiInputSchema,
  InternalSchemaValidatorInputSchema,
  LocalOcrAiInputSchema,
  LocalTextAiInputSchema,
  LocalVisionAiInputSchema,
  OcrCleanupInputSchema,
  PaidVisionAiInputSchema,
  ProductPresenceJudgmentInputSchema,
  ProductSignalSummaryInputSchema,
  SchemaValidationOnlyInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
} from "./schema-foundation.schema.js";
import {
  AiMapAuthoringOutputSchema,
  MapAuthoringInputSchema,
} from "./schema-map-authoring.schema.js";
import { AiChainFieldSchemas } from "./schema-chain-fields.js";

const AiCoreChainFieldSchema = z.object(AiChainFieldSchemas).strict();

function validateAiCoreChainFields(value: unknown, context: z.RefinementCtx) {
  const parsed = AiCoreChainFieldSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue(issue);
    }
  }
}

const AiInputSchema = z.discriminatedUnion("taskType", [
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  MapAuthoringInputSchema,
  SchemaValidationOnlyInputSchema,
]).superRefine((value, context) => {
  validateAiCoreChainFields(value, context);

  if (value.taskType === "map_authoring" && value.inputRefs.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "map_authoring requires at least one inputRef",
      path: ["inputRefs"],
    });
  }

  const expectedRequestedBy = value.taskType === "map_authoring" ? "commander-console" : "orchestration";
  const expectedTransportedBy = value.taskType === "map_authoring" ? "commander-console" : "nerve-bus";
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

const PaidAnalysisAiInputSchema = z.union([
  EvidencePacketAnalysisInputSchema,
  MapAuthoringInputSchema,
]);

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
  AiCommentSignalSummaryInputSchema,
  AiCommentSignalSummaryOutputSchema,
  AiOcrCleanupInputSchema,
  AiOcrCleanupOutputSchema,
  AiProductSignalSummaryInputSchema,
  AiProductSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisInputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiMapAuthoringOutputSchema,
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
  MapAuthoringInputSchema,
  SchemaValidationOnlyInputSchema,
  AiInputSchema,
  LocalVisionAiInputSchema,
  LocalTextAiInputSchema,
  LocalOcrAiInputSchema,
  InternalSchemaValidatorInputSchema,
  PaidVisionAiInputSchema,
  PaidAnalysisAiInputSchema,
  FutureApiAiInputSchema,
};