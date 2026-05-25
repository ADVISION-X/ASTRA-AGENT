import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
  RuntimeFailureClass,
  createStageLogger,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";
import {
  createDeepResearchTraceContext,
  logDeepResearchJobFailed,
} from "./deep-research-analysis.logging.js";
import { buildDeepResearchTextHash } from "./deep-research-analysis.prompt-hash.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import type {
  DeepResearchRecordStore,
  ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type { DeepResearchResult } from "./deep-research-analysis.result.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";

type AiGatewayExecutionResult = {
  status: "success" | "failed" | "review_required";
  normalizedText: string | null;
  rawOutputHash: string | null;
  rawOutputRef: string | null;
  providerProof: unknown;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
};

export type ProviderKind = "gemini-api" | "gemini-web-chat" | "gpt-web-chat";
export type StageLogger = ReturnType<typeof createStageLogger>;
export type StageTraceContext = ReturnType<typeof createDeepResearchTraceContext>;
export type FlowStageHandle = ReturnType<StageLogger["start"]>;
type FlowStageStartInput = Parameters<StageLogger["start"]>[0];
type FlowStageStartFields = Omit<FlowStageStartInput, "stageName">;

export type DeepResearchGatewayPromptPackage = {
  jobId: string;
  promptPackageId: string;
  promptContractId: string;
  promptText: string;
  promptHash: string;
  inputRefs: string[];
  providerKind: ProviderKind;
  timeoutMs: number;
  maxInputChars: number;
  maxFileCount: number;
  maxFileBytes: number;
};

export type DeepResearchGatewayResult = {
  status: "completed" | "review_required" | "failed";
  rawOutputRef: string | null;
  rawOutputHash: string;
  normalizedText: string;
  providerProofJson: string;
  errorReason: string | null;
};

export type DeepResearchGatewaySender = (
  promptPackage: DeepResearchGatewayPromptPackage,
) => Promise<DeepResearchGatewayResult>;

export type ExchangePersistSummary = {
  recordType: string;
  recordId: string;
  recordIds?: string[];
  count: number;
};

export type PromptExchangeSuccess<TParsed> = {
  status: "parsed";
  interaction: ResearchInteraction;
  parsed: TParsed;
  promptHash: string;
  rawResponseHash: string;
};

export type PromptExchangeFailure = {
  status: "failed" | "review_required";
  phase: DeepResearchPhase;
  reason: string;
  failureClass: typeof RuntimeFailureClass[keyof typeof RuntimeFailureClass];
  promptHash: string;
  rawResponseHash?: string;
};

export type DeepResearchAnalysisContext = {
  aiInputGateway?: AiInputGatewayAbilityGroup;
  runtimeLogger?: RuntimeLogger;
  dataDir?: string;
  providerKind: ProviderKind;
  modelName?: string;
  timeoutMs?: number;
  sendPromptPackage?: DeepResearchGatewaySender;
};

const mapGatewayResult = (
  result: AiGatewayExecutionResult,
): DeepResearchGatewayResult => {
  const normalizedText = result.normalizedText ?? "";
  return {
    status: result.status === "success" ? "completed" : result.status,
    rawOutputRef: result.rawOutputRef,
    rawOutputHash: result.rawOutputHash ?? buildDeepResearchTextHash(normalizedText),
    normalizedText,
    providerProofJson: JSON.stringify(result.providerProof),
    errorReason: result.failureReason ?? result.reviewRequiredReason ?? null,
  };
};

export const buildGatewaySender = (
  context: DeepResearchAnalysisContext,
): DeepResearchGatewaySender => {
  if (context.sendPromptPackage) {
    return context.sendPromptPackage;
  }
  const aiInputGateway = context.aiInputGateway;
  if (!aiInputGateway) {
    throw new Error(
      "Deep Research analysis requires sendPromptPackage or aiInputGateway.",
    );
  }
  return async (promptPackage) => {
    const result = await aiInputGateway.execute({
      providerKind: promptPackage.providerKind,
      promptPackageId: promptPackage.promptPackageId,
      promptContractId: promptPackage.promptContractId,
      expectedOutputSchemaRef: null,
      textPrompt: promptPackage.promptText,
      inputRefs: promptPackage.inputRefs.map((ref) => ({
        id: ref,
        kind: "prompt-input",
        summary: ref,
      })),
      modelName: context.modelName ?? null,
      timeoutMs: context.timeoutMs ?? promptPackage.timeoutMs,
      maxInputChars: promptPackage.maxInputChars,
      maxFileCount: promptPackage.maxFileCount,
      maxFileBytes: promptPackage.maxFileBytes,
      requestedBy: "ai-capability",
      missionId: promptPackage.jobId,
      runId: promptPackage.jobId,
      roundId: null,
    });
    return mapGatewayResult(result);
  };
};

export const buildPromptPackage = (input: {
  jobId: string;
  prompt: DeepResearchPrompt;
  promptKey: string;
  renderedPromptText: string;
  promptHash: string;
  providerKind: ProviderKind;
  inputRefs: string[];
  timeoutMs?: number;
  maxInputChars?: number;
}): DeepResearchGatewayPromptPackage => ({
  jobId: input.jobId,
  promptPackageId: `${input.jobId}:${input.promptKey}:${input.prompt.promptVersion}`,
  promptContractId: input.prompt.expectedOutputContract.contractId,
  promptText: input.renderedPromptText,
  promptHash: input.promptHash,
  inputRefs: input.inputRefs,
  providerKind: input.providerKind,
  timeoutMs: input.timeoutMs ?? 180_000,
  maxInputChars: input.maxInputChars ?? 30_000,
  maxFileCount: 0,
  maxFileBytes: 1,
});

export const rememberInteractionHashes = (
  recordHashes: Record<string, string>,
  interaction: ResearchInteraction,
): void => {
  recordHashes[`interaction:${interaction.id}:prompt`] = interaction.promptHash;
  recordHashes[`interaction:${interaction.id}:response`] =
    interaction.rawResponseHash;
};

export const ensureRuntimeContext = (
  context: DeepResearchAnalysisContext,
): {
  runtimeLogger: RuntimeLogger;
  dataDir: string;
} => {
  if (!context.runtimeLogger) {
    throw new Error("Deep Research analysis requires runtimeLogger.");
  }
  if (!context.dataDir) {
    throw new Error("Deep Research analysis requires dataDir.");
  }
  return {
    runtimeLogger: context.runtimeLogger,
    dataDir: context.dataDir,
  };
};

const buildTerminalResult = (input: {
  jobId: string;
  status: "failed" | "review_required";
  phase: DeepResearchPhase;
  reason: string;
  recordHashes: Record<string, string>;
}): DeepResearchResult => ({
  jobId: input.jobId,
  status: input.status,
  jobStatus: input.status === "failed" ? "failed" : "review_required",
  phase: input.phase,
  finalAdjudication: null,
  recordHashes: input.recordHashes,
  failureReason: input.status === "failed" ? input.reason : null,
  reviewReason: input.status === "review_required" ? input.reason : null,
});

export const finishFailure = (input: {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  jobId: string;
  status: "failed" | "review_required";
  phase: DeepResearchPhase;
  reason: string;
  failureClass: typeof RuntimeFailureClass[keyof typeof RuntimeFailureClass];
  recordHashes: Record<string, string>;
}): DeepResearchResult => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: input.status === "failed" ? "failed" : "review_required",
    phase: input.phase,
    failureReason: input.status === "failed" ? input.reason : null,
    reviewReason: input.status === "review_required" ? input.reason : null,
  });
  logDeepResearchJobFailed({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.phase,
    reason: input.reason,
    failureClass: input.failureClass,
    status: input.status,
  });
  return buildTerminalResult({
    jobId: input.jobId,
    status: input.status,
    phase: input.phase,
    reason: input.reason,
    recordHashes: input.recordHashes,
  });
};

export const buildFlowStageStartFields = (input: {
  traceContext: StageTraceContext;
  preview?: Record<string, string>;
  refs?: Record<string, string>;
  hashes?: Record<string, string>;
  metrics?: Record<string, number>;
  payload?: Record<string, unknown>;
}): FlowStageStartFields => ({
    context: input.traceContext,
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    ...(input.preview ? { preview: input.preview } : {}),
    ...(input.refs ? { refs: input.refs } : {}),
    ...(input.hashes ? { hashes: input.hashes } : {}),
    ...(input.metrics ? { metrics: input.metrics } : {}),
    ...(input.payload ? { payload: input.payload } : {}),
  });
