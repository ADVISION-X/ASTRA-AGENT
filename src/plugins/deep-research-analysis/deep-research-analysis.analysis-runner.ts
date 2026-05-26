import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
    RuntimeFailureClass,
    RuntimeLogEventType,
    createRuntimeEvent,
    createStageLogger,
    type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
    buildFullCaseFileStage,
    completeSuccessfulRun,
    runFinalAdjudicationPhase,
} from "./deep-research-analysis.analysis-finalization.js";
import {
    runDecompositionPhase,
    runSubQuestionPhases,
} from "./deep-research-analysis.analysis-sub-questions.js";
import { runBusinessHtmlReportPhase } from "./deep-research-analysis.html-report-stage.js";
import {
    createDeepResearchTraceContext,
    logDeepResearchJobFailed,
    logDeepResearchJobStarted,
} from "./deep-research-analysis.logging.js";
import type { DeepResearchResult } from "./deep-research-analysis.parser.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-bundle-shell.js";
import { buildDeepResearchTextHash } from "./deep-research-analysis.prompts.js";
import type {
    DeepResearchRecordStore,
    ResearchInteraction,
} from "./deep-research-analysis.records.js";
import { createDeepResearchRecordStore } from "./deep-research-analysis.records.js";
import type { DeepResearchInput, DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
    DeepResearchInputSchema
} from "./deep-research-analysis.schema.js";

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

export type AnalysisExecutionContext = {
  input: DeepResearchInput;
  dataDir: string;
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  jobId: string;
  providerKind: DeepResearchAnalysisContext["providerKind"];
  recordHashes: Record<string, string>;
};

type AnalysisSuccess = { ok: true };
export type AnalysisFailure = { ok: false; result: DeepResearchResult };
export type AnalysisOutcome = AnalysisSuccess | AnalysisFailure;

export const finishPromptFailure = (
  context: AnalysisExecutionContext,
  failure: PromptExchangeFailure,
): AnalysisFailure => ({
  ok: false,
  result: finishFailure({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    jobId: context.jobId,
    status: failure.status,
    phase: failure.phase,
    reason: failure.reason,
    failureClass: failure.failureClass,
    recordHashes: context.recordHashes,
  }),
});

const createExecutionContext = (
  input: DeepResearchInput,
  context: DeepResearchAnalysisContext,
): AnalysisExecutionContext => {
  const { runtimeLogger, dataDir } = ensureRuntimeContext(context);
  const sender = buildGatewaySender(context);
  const store = createDeepResearchRecordStore(dataDir);
  const job = store.createJob(input);
  return {
    input,
    dataDir,
    store,
    runtimeLogger,
    traceContext: createDeepResearchTraceContext(job.id),
    stageLogger: createStageLogger({ logger: runtimeLogger }),
    sender,
    jobId: job.id,
    providerKind: context.providerKind,
    recordHashes: {},
  };
};

const runAnalysisPhases = async (
  executionContext: AnalysisExecutionContext,
): Promise<DeepResearchResult> => {
  const decomposition = await runDecompositionPhase(executionContext);
  if (!decomposition.ok) {
    return decomposition.result;
  }
  const subQuestionOutcome = await runSubQuestionPhases(
    executionContext,
    decomposition.subQuestions,
  );
  if (!subQuestionOutcome.ok) {
    return subQuestionOutcome.result;
  }
  const finalPackageStage = buildFullCaseFileStage(executionContext);
  if (!finalPackageStage.ok) {
    return finalPackageStage.result;
  }
  const finalAdjudication = await runFinalAdjudicationPhase(
    executionContext,
    finalPackageStage.structuredIndex,
    finalPackageStage.fullCaseFile,
    finalPackageStage.fullCaseFileMarkdown,
  );
  if (!finalAdjudication.ok) {
    return finalAdjudication.result;
  }
  const businessHtmlReport = await runBusinessHtmlReportPhase(
    executionContext,
    finalPackageStage.structuredIndex,
    finalAdjudication.finalAdjudication,
    finalPackageStage.fullCaseFile,
    finalPackageStage.fullCaseFileMarkdown,
  );
  if (!businessHtmlReport.ok) {
    return businessHtmlReport.result;
  }
  return await completeSuccessfulRun(
    executionContext,
    finalPackageStage.structuredIndex,
    finalPackageStage.fullCaseFile,
    finalAdjudication.finalAdjudication,
  );
};

export const runDeepResearchAnalysis = async (
  rawInput: DeepResearchInput,
  context: DeepResearchAnalysisContext,
): Promise<DeepResearchResult> => {
  const input = DeepResearchInputSchema.parse(rawInput);
  const executionContext = createExecutionContext(input, context);
  const { runtimeLogger, traceContext, store, jobId } = executionContext;

  try {
    logDeepResearchJobStarted({
      logger: runtimeLogger,
      traceContext,
      phase: "INTAKE",
      inputHash: stableJsonHash(input),
    });
    return await runAnalysisPhases(executionContext);
  } catch (error) {
    const currentPhase = store.getJob(jobId)?.phase ?? "INTAKE";
    const reason =
      error instanceof Error ? error.message : "deep_research_internal_failure";
    runtimeLogger.emit(createRuntimeEvent({
      context: traceContext,
      eventType: RuntimeLogEventType.DEEP_RESEARCH_JOB_FAILED,
      level: "error",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status: "failed",
      reason,
      payload: {
        phase: currentPhase,
        failureClass: RuntimeFailureClass.INTERNAL_BUG,
        stageName: currentPhase,
        retryable: false,
        terminal: true,
        recoveryPolicy: "terminal",
      },
    }));
    return finishFailure({
      store,
      runtimeLogger,
      traceContext,
      jobId,
      status: "failed",
      phase: currentPhase,
      reason,
      failureClass: RuntimeFailureClass.INTERNAL_BUG,
      recordHashes: executionContext.recordHashes,
    });
  } finally {
    store.close();
  }
};
