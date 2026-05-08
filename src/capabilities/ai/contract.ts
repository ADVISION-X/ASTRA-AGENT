import type { z } from "zod";

import type { AiClockPort } from "./ports/ai-clock-port.js";
import type { AiModelRosterPort } from "./ports/ai-model-roster-port.js";
import type { AiPromptRegistryPort } from "./ports/ai-prompt-registry-port.js";
import type { AiRuntimePort } from "./ports/ai-runtime-port.js";
import type { AiRuntimeStructuredDebugEvent } from "./runtime-adapters/local-ai-runtime-debug-contract.js";
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
  AiPagePreparationOutputSchema,
  AiSchemaValidationOnlyInputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
  AiVisualTargetCandidateOutputSchema,
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
  PagePreparationJudgmentInputSchema,
  PagePreparationJudgmentResultSchema,
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

type AiAbilityGroupId = typeof AI_ABILITY_GROUP_ID;
type AiChildCapabilityId = (typeof AI_CHILD_CAPABILITY_IDS)[number];
type AiAbilityInput = z.input<typeof AiInputSchema>;
type ParsedAiAbilityInput = z.output<typeof AiInputSchema>;
type AiAbilityResult = z.output<typeof AiResultSchema>;
type AiDispatchFailureEnvelope = z.output<typeof AiDispatchFailureEnvelopeSchema>;
type AiAbilityOutcome = z.output<typeof AiAbilityOutcomeSchema>;
type AiRuntimeProof = z.output<typeof AiRuntimeProofSchema>;
type AiPromptContract = z.output<typeof AiPromptContractSchema>;
type AiProviderPolicy = z.output<typeof AiProviderPolicySchema>;
type AiDataPolicy = z.output<typeof AiDataPolicySchema>;
type AiCostPolicy = z.output<typeof AiCostPolicySchema>;
type AiQualityPolicy = z.output<typeof AiQualityPolicySchema>;
type AiSafetyPolicy = z.output<typeof AiSafetyPolicySchema>;
type AiRuntimeHealth = z.output<typeof AiRuntimeHealthSchema>;
type AiHealthReport = z.output<typeof AiHealthReportSchema>;
type AiModelRoster = z.output<typeof AiModelRosterSchema>;
type AiModelRosterEntry = z.output<typeof AiModelRosterEntrySchema>;
type AiRuntimeExecutionOutput = z.output<typeof AiRuntimeExecutionOutputSchema>;
type AiChildReadiness = z.output<typeof AiChildReadinessSchema>;

type PagePreparationJudgmentInput = z.output<typeof PagePreparationJudgmentInputSchema>;
type ProductPresenceJudgmentInput = z.output<typeof ProductPresenceJudgmentInputSchema>;
type VisualObservationInput = z.output<typeof VisualObservationInputSchema>;
type VisualTargetCandidateAnalysisInput = z.output<typeof VisualTargetCandidateAnalysisInputSchema>;
type OcrCleanupInput = z.output<typeof OcrCleanupInputSchema>;
type CommentSignalSummaryInput = z.output<typeof CommentSignalSummaryInputSchema>;
type ProductSignalSummaryInput = z.output<typeof ProductSignalSummaryInputSchema>;
type EvidencePacketAnalysisInput = z.output<typeof EvidencePacketAnalysisInputSchema>;
type SchemaValidationOnlyInput = z.output<typeof SchemaValidationOnlyInputSchema>;

type AiPagePreparationOutput = z.output<typeof AiPagePreparationOutputSchema>;
type AiVisualOutput = z.output<typeof AiVisualOutputSchema>;
type AiVisualTargetCandidateOutput = z.output<typeof AiVisualTargetCandidateOutputSchema>;
type AiOcrCleanupInput = z.output<typeof AiOcrCleanupInputSchema>;
type AiOcrCleanupOutput = z.output<typeof OcrCleanupResultSchema>["output"];
type AiCommentSignalSummaryInput = z.output<typeof AiCommentSignalSummaryInputSchema>;
type AiCommentSignalSummaryOutput = z.output<typeof AiCommentSignalSummaryOutputSchema>;
type AiProductSignalSummaryInput = z.output<typeof AiProductSignalSummaryInputSchema>;
type AiProductSignalSummaryOutput = z.output<typeof AiProductSignalSummaryOutputSchema>;
type AiEvidencePacketAnalysisInput = z.output<typeof AiEvidencePacketAnalysisInputSchema>;
type AiEvidencePacketAnalysisOutput = z.output<typeof AiEvidencePacketAnalysisOutputSchema>;
type AiSchemaValidationOnlyInput = z.output<typeof AiSchemaValidationOnlyInputSchema>;
type AiSchemaValidationOnlyOutput = z.output<typeof AiSchemaValidationOnlyOutputSchema>;

type LocalVisionAiInput = z.output<typeof LocalVisionAiInputSchema>;
type LocalVisionAiResult = z.output<typeof LocalVisionAiResultSchema>;
type LocalTextAiInput = z.output<typeof LocalTextAiInputSchema>;
type LocalTextAiResult = z.output<typeof LocalTextAiResultSchema>;
type LocalOcrAiInput = z.output<typeof LocalOcrAiInputSchema>;
type LocalOcrAiResult = z.output<typeof LocalOcrAiResultSchema>;
type InternalSchemaValidatorInput = z.output<typeof InternalSchemaValidatorInputSchema>;
type InternalSchemaValidatorResult = z.output<typeof InternalSchemaValidatorResultSchema>;
type PaidVisionAiInput = z.output<typeof PaidVisionAiInputSchema>;
type PaidVisionAiResult = z.output<typeof PaidVisionAiResultSchema>;
type PaidAnalysisAiInput = z.output<typeof PaidAnalysisAiInputSchema>;
type PaidAnalysisAiResult = z.output<typeof PaidAnalysisAiResultSchema>;

type AiTaskType = ParsedAiAbilityInput["taskType"];
type AiProviderKind = AiAbilityResult["modelProvider"];
type AiExecutionStatus = AiAbilityResult["status"];
type AiModelRole = AiAbilityResult["modelRole"];

type AiExecutionContext = {
  runtime: AiRuntimePort;
  clock: AiClockPort;
  modelRoster: AiModelRosterPort;
  promptRegistry: AiPromptRegistryPort;
  emitDebugEvent?: ((event: AiRuntimeStructuredDebugEvent) => void | Promise<void>) | undefined;
  abortSignal?: AbortSignal | undefined;
};

type AiExecuteOptions = {
  signal?: AbortSignal | undefined;
};

type AiChildContract = {
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

interface AiChildImplementation {
  execute?(input: ParsedAiAbilityInput, context: AiExecutionContext): Promise<AiAbilityResult>;
  checkReadiness(context: AiExecutionContext): Promise<AiChildReadiness>;
}

type AiChildCapability = {
  contract: AiChildContract;
  implementation: AiChildImplementation;
};

type AiChildCapabilityRegistryEntry = {
  childCapabilityId: AiChildCapabilityId;
  providerKind: AiProviderKind;
  allowedTaskTypes: readonly AiTaskType[];
  executable: boolean;
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
  boundaryPolicy: AiChildContract["boundaryPolicy"];
  proofPolicy: AiChildContract["proofPolicy"];
  disabledPolicy: "enabled" | "disabled_by_policy";
  contract: AiChildContract;
  implementation: AiChildImplementation;
};

interface AiAbilityGroup {
  listChildCapabilityIds(): AiChildCapabilityId[];
  execute(input: AiAbilityInput, options?: AiExecuteOptions): Promise<AiAbilityOutcome>;
  getHealth(): Promise<AiHealthReport>;
  getRuntimeHealth(): Promise<AiRuntimeHealth>;
}

export type {
  AiAbilityGroupId,
  AiChildCapabilityId,
  AiAbilityInput,
  ParsedAiAbilityInput,
  AiAbilityResult,
  AiDispatchFailureEnvelope,
  AiAbilityOutcome,
  AiRuntimeProof,
  AiPromptContract,
  AiProviderPolicy,
  AiDataPolicy,
  AiCostPolicy,
  AiQualityPolicy,
  AiSafetyPolicy,
  AiRuntimeHealth,
  AiHealthReport,
  AiModelRoster,
  AiModelRosterEntry,
  AiRuntimeExecutionOutput,
  AiChildReadiness,
  PagePreparationJudgmentInput,
  ProductPresenceJudgmentInput,
  VisualObservationInput,
  VisualTargetCandidateAnalysisInput,
  OcrCleanupInput,
  CommentSignalSummaryInput,
  ProductSignalSummaryInput,
  EvidencePacketAnalysisInput,
  SchemaValidationOnlyInput,
  AiPagePreparationOutput,
  AiVisualOutput,
  AiVisualTargetCandidateOutput,
  AiOcrCleanupInput,
  AiOcrCleanupOutput,
  AiCommentSignalSummaryInput,
  AiCommentSignalSummaryOutput,
  AiProductSignalSummaryInput,
  AiProductSignalSummaryOutput,
  AiEvidencePacketAnalysisInput,
  AiEvidencePacketAnalysisOutput,
  AiSchemaValidationOnlyInput,
  AiSchemaValidationOnlyOutput,
  LocalVisionAiInput,
  LocalVisionAiResult,
  LocalTextAiInput,
  LocalTextAiResult,
  LocalOcrAiInput,
  LocalOcrAiResult,
  InternalSchemaValidatorInput,
  InternalSchemaValidatorResult,
  PaidVisionAiInput,
  PaidVisionAiResult,
  PaidAnalysisAiInput,
  PaidAnalysisAiResult,
  AiTaskType,
  AiProviderKind,
  AiExecutionStatus,
  AiModelRole,
  AiExecutionContext,
  AiExecuteOptions,
  AiChildContract,
  AiChildImplementation,
  AiChildCapability,
  AiChildCapabilityRegistryEntry,
  AiAbilityGroup,
};

export { AiVisionRequestInputSchema } from "./schema-core.schema.js";
export type { AiRuntimePort } from "./ports/ai-runtime-port.js";
export type { AiRuntimeStructuredDebugEvent } from "./runtime-adapters/local-ai-runtime-debug-contract.js";
