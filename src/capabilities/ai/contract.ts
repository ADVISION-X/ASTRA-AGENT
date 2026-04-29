import type { z } from "zod";

import type { AiClockPort } from "./ports/ai-clock-port.js";
import type { AiModelRosterPort } from "./ports/ai-model-roster-port.js";
import type { AiPromptRegistryPort } from "./ports/ai-prompt-registry-port.js";
import type { AiRuntimePort } from "./ports/ai-runtime-port.js";
import {
  AI_ABILITY_GROUP_ID,
  AI_CHILD_CAPABILITY_IDS,
} from "./shared/ai-types.js";
import {
  AiChildReadinessSchema,
  AiCommentSignalSummaryInputSchema,
  AiCommentSignalSummaryOutputSchema,
  AiCostPolicySchema,
  AiDataPolicySchema,
  AiEvidencePacketAnalysisInputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiHealthReportSchema,
  AiInputSchema,
  AiAbilityOutcomeSchema,
  AiDispatchFailureEnvelopeSchema,
  AiModelRosterEntrySchema,
  AiModelRosterSchema,
  AiOcrCleanupInputSchema,
  AiProductSignalSummaryInputSchema,
  AiProductSignalSummaryOutputSchema,
  AiPromptContractSchema,
  AiProviderPolicySchema,
  AiQualityPolicySchema,
  AiResultSchema,
  AiRuntimeExecutionOutputSchema,
  AiRuntimeHealthSchema,
  AiRuntimeProofSchema,
  AiSafetyPolicySchema,
  AiSchemaValidationOnlyInputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
  CommentSignalSummaryInputSchema,
  CommentSignalSummaryResultSchema,
  EvidencePacketAnalysisInputSchema,
  EvidencePacketAnalysisResultSchema,
  InternalSchemaValidatorInputSchema,
  InternalSchemaValidatorResultSchema,
  LocalOcrAiInputSchema,
  LocalOcrAiResultSchema,
  LocalTextAiInputSchema,
  LocalTextAiResultSchema,
  LocalVisionAiInputSchema,
  LocalVisionAiResultSchema,
  OcrCleanupInputSchema,
  OcrCleanupResultSchema,
  PaidAnalysisAiInputSchema,
  PaidAnalysisAiResultSchema,
  PaidVisionAiInputSchema,
  PaidVisionAiResultSchema,
  ProductPresenceJudgmentInputSchema,
  ProductPresenceJudgmentResultSchema,
  ProductSignalSummaryInputSchema,
  ProductSignalSummaryResultSchema,
  SchemaValidationOnlyInputSchema,
  SchemaValidationOnlyResultSchema,
  VisualObservationInputSchema,
  VisualObservationResultSchema,
  VisualTargetCandidateAnalysisInputSchema,
  VisualTargetCandidateAnalysisResultSchema,
} from "./schema.js";

export { AI_ABILITY_GROUP_ID, AI_CHILD_CAPABILITY_IDS };

export type AiAbilityGroupId = typeof AI_ABILITY_GROUP_ID;
export type AiChildCapabilityId = (typeof AI_CHILD_CAPABILITY_IDS)[number];
export type AiAbilityInput = z.input<typeof AiInputSchema>;
export type ParsedAiAbilityInput = z.output<typeof AiInputSchema>;
export type AiAbilityResult = z.output<typeof AiResultSchema>;
export type AiDispatchFailureEnvelope = z.output<typeof AiDispatchFailureEnvelopeSchema>;
export type AiAbilityOutcome = z.output<typeof AiAbilityOutcomeSchema>;
export type AiRuntimeProof = z.output<typeof AiRuntimeProofSchema>;
export type AiPromptContract = z.output<typeof AiPromptContractSchema>;
export type AiProviderPolicy = z.output<typeof AiProviderPolicySchema>;
export type AiDataPolicy = z.output<typeof AiDataPolicySchema>;
export type AiCostPolicy = z.output<typeof AiCostPolicySchema>;
export type AiQualityPolicy = z.output<typeof AiQualityPolicySchema>;
export type AiSafetyPolicy = z.output<typeof AiSafetyPolicySchema>;
export type AiRuntimeHealth = z.output<typeof AiRuntimeHealthSchema>;
export type AiHealthReport = z.output<typeof AiHealthReportSchema>;
export type AiModelRoster = z.output<typeof AiModelRosterSchema>;
export type AiModelRosterEntry = z.output<typeof AiModelRosterEntrySchema>;
export type AiRuntimeExecutionOutput = z.output<typeof AiRuntimeExecutionOutputSchema>;
export type AiChildReadiness = z.output<typeof AiChildReadinessSchema>;

export type ProductPresenceJudgmentInput = z.output<typeof ProductPresenceJudgmentInputSchema>;
export type VisualObservationInput = z.output<typeof VisualObservationInputSchema>;
export type VisualTargetCandidateAnalysisInput = z.output<typeof VisualTargetCandidateAnalysisInputSchema>;
export type OcrCleanupInput = z.output<typeof OcrCleanupInputSchema>;
export type CommentSignalSummaryInput = z.output<typeof CommentSignalSummaryInputSchema>;
export type ProductSignalSummaryInput = z.output<typeof ProductSignalSummaryInputSchema>;
export type EvidencePacketAnalysisInput = z.output<typeof EvidencePacketAnalysisInputSchema>;
export type SchemaValidationOnlyInput = z.output<typeof SchemaValidationOnlyInputSchema>;

export type AiVisualOutput = z.output<typeof AiVisualOutputSchema>;
export type AiOcrCleanupInput = z.output<typeof AiOcrCleanupInputSchema>;
export type AiOcrCleanupOutput = z.output<typeof OcrCleanupResultSchema>["output"];
export type AiCommentSignalSummaryInput = z.output<typeof AiCommentSignalSummaryInputSchema>;
export type AiCommentSignalSummaryOutput = z.output<typeof AiCommentSignalSummaryOutputSchema>;
export type AiProductSignalSummaryInput = z.output<typeof AiProductSignalSummaryInputSchema>;
export type AiProductSignalSummaryOutput = z.output<typeof AiProductSignalSummaryOutputSchema>;
export type AiEvidencePacketAnalysisInput = z.output<typeof AiEvidencePacketAnalysisInputSchema>;
export type AiEvidencePacketAnalysisOutput = z.output<typeof AiEvidencePacketAnalysisOutputSchema>;
export type AiSchemaValidationOnlyInput = z.output<typeof AiSchemaValidationOnlyInputSchema>;
export type AiSchemaValidationOnlyOutput = z.output<typeof AiSchemaValidationOnlyOutputSchema>;

export type LocalVisionAiInput = z.output<typeof LocalVisionAiInputSchema>;
export type LocalVisionAiResult = z.output<typeof LocalVisionAiResultSchema>;
export type LocalTextAiInput = z.output<typeof LocalTextAiInputSchema>;
export type LocalTextAiResult = z.output<typeof LocalTextAiResultSchema>;
export type LocalOcrAiInput = z.output<typeof LocalOcrAiInputSchema>;
export type LocalOcrAiResult = z.output<typeof LocalOcrAiResultSchema>;
export type InternalSchemaValidatorInput = z.output<typeof InternalSchemaValidatorInputSchema>;
export type InternalSchemaValidatorResult = z.output<typeof InternalSchemaValidatorResultSchema>;
export type PaidVisionAiInput = z.output<typeof PaidVisionAiInputSchema>;
export type PaidVisionAiResult = z.output<typeof PaidVisionAiResultSchema>;
export type PaidAnalysisAiInput = z.output<typeof PaidAnalysisAiInputSchema>;
export type PaidAnalysisAiResult = z.output<typeof PaidAnalysisAiResultSchema>;

export type AiTaskType = ParsedAiAbilityInput["taskType"];
export type AiProviderKind = AiAbilityResult["modelProvider"];
export type AiExecutionStatus = AiAbilityResult["status"];
export type AiModelRole = AiAbilityResult["modelRole"];

export type AiExecutionContext = {
  runtime: AiRuntimePort;
  clock: AiClockPort;
  modelRoster: AiModelRosterPort;
  promptRegistry: AiPromptRegistryPort;
};

export type AiChildContract = {
  abilityGroupId: AiAbilityGroupId;
  childCapabilityId: AiChildCapabilityId;
  providerKind: AiProviderKind;
  supportedTaskTypes: readonly AiTaskType[];
  modelRole: AiModelRole;
  runtimeOwner: "ai-executor";
  implementationStatus: string;
  purpose: string;
  executionPolicy: {
    allowedTaskTypes: readonly AiTaskType[];
    requiresLocalRuntime: boolean;
    executable: boolean;
    forbidsLocalAiGateway: boolean;
    forbidsLocalFallback: boolean;
  };
  boundaryPolicy: {
    forbidsPlatformActions: true;
    forbidsExecutableOutput: true;
    outputBoundaryGate: "ai-output-boundary-gate";
  };
  proofPolicy: {
    requiresRuntimeProof: true;
    requiresResultParse: true;
    requiresProofParse: true;
  };
};

export interface AiChildImplementation {
  execute?(input: ParsedAiAbilityInput, context: AiExecutionContext): Promise<AiAbilityResult>;
  checkReadiness(context: AiExecutionContext): Promise<AiChildReadiness>;
}

export type AiChildCapability = {
  contract: AiChildContract;
  implementation: AiChildImplementation;
};

export interface AiAbilityGroup {
  listChildCapabilityIds(): AiChildCapabilityId[];
  execute(input: AiAbilityInput): Promise<AiAbilityOutcome>;
  getHealth(): Promise<AiHealthReport>;
  getRuntimeHealth(): Promise<AiRuntimeHealth>;
  getPromptContract(taskType: AiTaskType): AiPromptContract;
  getModelRoster(): Promise<AiModelRoster>;
}

export type { AiRuntimePort } from "./ports/ai-runtime-port.js";
