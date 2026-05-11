import { z } from "zod";

import {
  AiInputSchema as BaseAiInputSchema,
  LocalVisionAiInputSchema as BaseLocalVisionAiInputSchema,
} from "./schema-core.schema.js";
import {
  AiBaseRuntimeProofFieldSchemas,
  AiAbilityOutcomeSchema as BaseAiAbilityOutcomeSchema,
  AiHealthReportSchema,
  AiResultSchema as BaseAiResultSchema,
  AiRuntimeProofSchema,
  LocalVisionAiResultSchema as BaseLocalVisionAiResultSchema,
} from "./schema-runtime.schema.js";
import {
  AiVisualMissionActionPlanInputSchema,
  AiVisualMissionActionPlanOutputSchema,
  AiVisualMissionActionPlanResultSchema,
} from "./schema-visual-mission-action-plan.schema.js";

const AiBaseRuntimeProofSchema = z.object({
  proofId: AiBaseRuntimeProofFieldSchemas.proofId,
  runId: AiBaseRuntimeProofFieldSchemas.runId,
  missionId: AiBaseRuntimeProofFieldSchemas.missionId,
  missionIdSource: AiBaseRuntimeProofFieldSchemas.missionIdSource,
  sessionId: AiBaseRuntimeProofFieldSchemas.sessionId,
  roundId: AiBaseRuntimeProofFieldSchemas.roundId,
  videoVisitId: AiBaseRuntimeProofFieldSchemas.videoVisitId,
  abilityGroupId: AiBaseRuntimeProofFieldSchemas.abilityGroupId,
  childCapabilityId: AiBaseRuntimeProofFieldSchemas.childCapabilityId,
  taskType: AiBaseRuntimeProofFieldSchemas.taskType,
  promptContractId: AiBaseRuntimeProofFieldSchemas.promptContractId,
  expectedOutputSchema: AiBaseRuntimeProofFieldSchemas.expectedOutputSchema,
  modelProvider: AiBaseRuntimeProofFieldSchemas.modelProvider,
  modelName: AiBaseRuntimeProofFieldSchemas.modelName,
  modelRole: AiBaseRuntimeProofFieldSchemas.modelRole,
  runtime: AiBaseRuntimeProofFieldSchemas.runtime,
  requestHash: AiBaseRuntimeProofFieldSchemas.requestHash,
  inputPayloadHash: AiBaseRuntimeProofFieldSchemas.inputPayloadHash,
  promptContractHash: AiBaseRuntimeProofFieldSchemas.promptContractHash,
  modelConfigHash: AiBaseRuntimeProofFieldSchemas.modelConfigHash,
  runtimeCallId: AiBaseRuntimeProofFieldSchemas.runtimeCallId,
  inputRefs: AiBaseRuntimeProofFieldSchemas.inputRefs,
  outputRefs: AiBaseRuntimeProofFieldSchemas.outputRefs,
  evidenceRefs: AiBaseRuntimeProofFieldSchemas.evidenceRefs,
  rawOutputRef: AiBaseRuntimeProofFieldSchemas.rawOutputRef,
  rawOutputHash: AiBaseRuntimeProofFieldSchemas.rawOutputHash,
  runLockId: AiBaseRuntimeProofFieldSchemas.runLockId,
  cancellationTokenRef: AiBaseRuntimeProofFieldSchemas.cancellationTokenRef,
  resumeCheckpointRef: AiBaseRuntimeProofFieldSchemas.resumeCheckpointRef,
  timeoutMs: AiBaseRuntimeProofFieldSchemas.timeoutMs,
  attemptIndex: AiBaseRuntimeProofFieldSchemas.attemptIndex,
  retryCount: AiBaseRuntimeProofFieldSchemas.retryCount,
  maxRetry: AiBaseRuntimeProofFieldSchemas.maxRetry,
  circuitBreakerState: AiBaseRuntimeProofFieldSchemas.circuitBreakerState,
  gatewayDurationMs: AiBaseRuntimeProofFieldSchemas.gatewayDurationMs,
  startedAt: AiBaseRuntimeProofFieldSchemas.startedAt,
  endedAt: AiBaseRuntimeProofFieldSchemas.endedAt,
  durationMs: AiBaseRuntimeProofFieldSchemas.durationMs,
  status: AiBaseRuntimeProofFieldSchemas.status,
  failureReason: AiBaseRuntimeProofFieldSchemas.failureReason,
  reviewRequiredReason: AiBaseRuntimeProofFieldSchemas.reviewRequiredReason,
  providerDecision: AiBaseRuntimeProofFieldSchemas.providerDecision,
  dataPolicyDecision: AiBaseRuntimeProofFieldSchemas.dataPolicyDecision,
  costPolicyDecision: AiBaseRuntimeProofFieldSchemas.costPolicyDecision,
  safetyPolicyDecision: AiBaseRuntimeProofFieldSchemas.safetyPolicyDecision,
  schemaDecision: AiBaseRuntimeProofFieldSchemas.schemaDecision,
  qualityDecision: AiBaseRuntimeProofFieldSchemas.qualityDecision,
  outputBoundaryDecision: AiBaseRuntimeProofFieldSchemas.outputBoundaryDecision,
  disabledProviderDecision: AiBaseRuntimeProofFieldSchemas.disabledProviderDecision,
  schemaIssueCount: AiBaseRuntimeProofFieldSchemas.schemaIssueCount,
  boundaryViolationCount: AiBaseRuntimeProofFieldSchemas.boundaryViolationCount,
  qualityDecisionReason: AiBaseRuntimeProofFieldSchemas.qualityDecisionReason,
  dataQualityFlags: AiBaseRuntimeProofFieldSchemas.dataQualityFlags,
  clockPortKind: AiBaseRuntimeProofFieldSchemas.clockPortKind,
}).strict();

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
  AiPagePreparationOutputSchema,
  AiVisualOutputSchema,
  PagePreparationJudgmentInputSchema,
  ProductPresenceJudgmentInputSchema,
  VisualObservationInputSchema,
  VisualTargetCandidateAnalysisInputSchema,
  OcrCleanupInputSchema,
  CommentSignalSummaryInputSchema,
  ProductSignalSummaryInputSchema,
  EvidencePacketAnalysisInputSchema,
  SchemaValidationOnlyInputSchema,
  LocalTextAiInputSchema,
  LocalOcrAiInputSchema,
  InternalSchemaValidatorInputSchema,
  PaidVisionAiInputSchema,
  PaidAnalysisAiInputSchema,
  FutureApiAiInputSchema,
} from "./schema-core.schema.js";

export { AiBaseRuntimeProofSchema };

export {
  AiRuntimeProofSchema,
  AiRuntimeExecutionOutputSchema,
  AiForbiddenActionOutputFieldSchema,
  PagePreparationJudgmentResultSchema,
  ProductPresenceJudgmentResultSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisResultSchema,
  OcrCleanupResultSchema,
  CommentSignalSummaryResultSchema,
  ProductSignalSummaryResultSchema,
  EvidencePacketAnalysisResultSchema,
  SchemaValidationOnlyResultSchema,
  AiDispatchFailureEnvelopeSchema,
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

export { AiVisualTargetCandidateOutputSchema } from "./schema-core.schema.js";

const AiInputSchema = z.lazy(() => z.union([BaseAiInputSchema, AiVisualMissionActionPlanInputSchema]));
const LocalVisionAiInputSchema = z.lazy(() => z.union([BaseLocalVisionAiInputSchema, AiVisualMissionActionPlanInputSchema]));
const AiResultSchema = z.lazy(() => z.union([BaseAiResultSchema, AiVisualMissionActionPlanResultSchema]));
const LocalVisionAiResultSchema = z.lazy(() => z.union([BaseLocalVisionAiResultSchema, AiVisualMissionActionPlanResultSchema]));
const AiAbilityOutcomeSchema = z.lazy(() => z.union([BaseAiAbilityOutcomeSchema, AiVisualMissionActionPlanResultSchema]));

export {
  AiInputSchema,
  LocalVisionAiInputSchema,
  AiVisualMissionActionPlanInputSchema,
  AiVisualMissionActionPlanOutputSchema,
  AiResultSchema,
  LocalVisionAiResultSchema,
  AiVisualMissionActionPlanResultSchema,
  AiAbilityOutcomeSchema,
};

export function parseAiInput(input: unknown) {
  return AiInputSchema.safeParse(input);
}

export function parseAiResult(input: unknown) {
  return AiResultSchema.safeParse(input);
}

export function parseAiAbilityOutcome(input: unknown) {
  return AiAbilityOutcomeSchema.safeParse(input);
}