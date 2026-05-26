import { RuntimeFailureClass, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type {
    DeepResearchGatewayPromptPackage,
    DeepResearchGatewayResult,
    DeepResearchGatewaySender,
    ExchangePersistSummary,
    PromptExchangeFailure,
    ProviderKind,
    StageLogger,
    StageTraceContext,
} from "./deep-research-analysis.analysis-runner.js";
import {
    type FlowStageHandle,
    buildFlowStageStartFields,
} from "./deep-research-analysis.analysis-runner.js";
import {
    logDeepResearchDomCaptureCompleted,
    logDeepResearchDomCaptureStarted,
} from "./deep-research-analysis.logging.js";
import type { DeepResearchParserResult } from "./deep-research-analysis.parser.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-bundle-shell.js";
import {
    type DeepResearchRecordStore,
    type ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";

export type SuccessfulParserResult<TParsed> = Exclude<
  DeepResearchParserResult<TParsed>,
  { parsed: null }
>;

export type FailedParserResult<TParsed> = Extract<
  DeepResearchParserResult<TParsed>,
  { parsed: null }
> & {
  reason: string;
};

type PromptPreview = {
  promptId: string;
  promptVersion: string;
  subQuestionId?: string;
};

export type CaptureSuccess = {
  gatewayResult: DeepResearchGatewayResult;
  domRef: string;
};

export type CapturePromptOutputInput = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  jobId: string;
  prompt: DeepResearchPrompt;
  promptPackage: DeepResearchGatewayPromptPackage;
  promptHash: string;
  renderedPromptText: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  subQuestionId?: string;
};

export type ParseSuccess<TParsed> = {
  parsed: SuccessfulParserResult<TParsed>;
  recordCount: number;
};

export type ParsePromptOutputInput<TParsed> = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  recordHashes: Record<string, string>;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
  renderedPromptText: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  domRef: string;
  gatewayResult: DeepResearchGatewayResult;
  subQuestionId?: string;
  parse: (rawText: string) => DeepResearchParserResult<TParsed>;
  successRecordCount: (parsed: TParsed) => number;
};

export type PersistPromptOutputInput<TParsed> = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  recordHashes: Record<string, string>;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
  renderedPromptText: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  subQuestionId?: string;
  domRef: string;
  gatewayResult: DeepResearchGatewayResult;
  parsed: SuccessfulParserResult<TParsed>;
  persist: (input: {
    interaction: ResearchInteraction;
    parsed: TParsed;
  }) => ExchangePersistSummary;
};

export const buildDomRef = (
  promptId: string,
  jobId: string,
  rawOutputRef: string | null,
): string => rawOutputRef ?? `artifact://deep-research/${jobId}/${promptId}`;

export const buildGatewayFailure = (input: {
  stage: DeepResearchPhase;
  status: "failed" | "review_required";
  promptHash: string;
  rawResponseHash: string;
  gatewayStatus: DeepResearchGatewayResult["status"];
  reason: string | null;
}): PromptExchangeFailure => ({
  status: input.status,
  phase: input.stage,
  reason: input.reason ?? `ai_gateway_${input.gatewayStatus}`,
  failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
  promptHash: input.promptHash,
  rawResponseHash: input.rawResponseHash,
});

export const buildParseFailure = (input: {
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  reason: string;
  status: "failed" | "review_required";
}): PromptExchangeFailure => ({
  status: input.status,
  phase: input.stage,
  reason: input.reason,
  failureClass: RuntimeFailureClass.AI_PARSE_FAILURE,
  promptHash: input.promptHash,
  rawResponseHash: input.rawResponseHash,
});

export const createInteractionRecord = <TParsed>(input: {
  store: DeepResearchRecordStore;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
  renderedPromptText: string;
  subQuestionId?: string;
  domRef: string;
  gatewayResult: DeepResearchGatewayResult;
  parsed: SuccessfulParserResult<TParsed>;
}): ResearchInteraction =>
  input.store.createInteraction({
    jobId: input.jobId,
    phase: input.prompt.phase,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.promptVersion,
    promptHash: input.promptHash,
    renderedPromptText: input.renderedPromptText,
    domRef: input.domRef,
    rawResponseText: input.gatewayResult.normalizedText,
    rawResponseHash: input.parsed.rawResponseHash,
    normalizedText: input.parsed.normalizedText,
    parseStatus: input.parsed.parseStatus,
    providerKind: input.providerKind,
    providerProofJson: input.gatewayResult.providerProofJson,
  });

export const createFailedInteractionRecord = <TParsed>(input: {
  store: DeepResearchRecordStore;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
  renderedPromptText: string;
  subQuestionId?: string;
  domRef: string;
  gatewayResult: DeepResearchGatewayResult;
  parsed: FailedParserResult<TParsed>;
}): ResearchInteraction =>
  input.store.createInteraction({
    jobId: input.jobId,
    phase: input.prompt.phase,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.promptVersion,
    promptHash: input.promptHash,
    renderedPromptText: input.renderedPromptText,
    domRef: input.domRef,
    rawResponseText: input.gatewayResult.normalizedText,
    rawResponseHash: input.parsed.rawResponseHash,
    normalizedText: input.parsed.normalizedText,
    parseStatus: input.parsed.parseStatus,
    providerKind: input.providerKind,
    providerProofJson: input.gatewayResult.providerProofJson,
  });

const completeCaptureFailure = (captureStage: FlowStageHandle, input: {
  status: "failed" | "review_required";
  reason: string;
  domRef: string;
  promptHash: string;
  rawResponseHash: string;
}): void => {
  const terminalInput = {
    reason: input.reason,
    failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
    retryable: true,
    terminal: true,
    recoveryPolicy: "review_required" as const,
    refs: { domRef: input.domRef },
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
  };
  if (input.status === "failed") {
    captureStage.fail(terminalInput);
    return;
  }
  captureStage.reviewRequired(terminalInput);
};

const completeCaptureSuccess = (input: {
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  domRef: string;
  subQuestionId?: string;
} & Pick<CapturePromptOutputInput, "runtimeLogger" | "traceContext">, captureStage: FlowStageHandle): void => {
  logDeepResearchDomCaptureCompleted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: input.rawResponseHash,
    domRef: input.domRef,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  captureStage.complete({
    durationMs: Math.max(0, Date.now() - captureStage.startedAt),
    refs: { domRef: input.domRef },
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
  });
};

const continueCapturePromptOutput = async (
  input: CapturePromptOutputInput & { captureStage: FlowStageHandle },
): Promise<CaptureSuccess | ReturnType<typeof buildGatewayFailure>> => {
  logDeepResearchDomCaptureStarted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    promptHash: input.promptHash,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  const gatewayResult = await input.sender(input.promptPackage);
  if (gatewayResult.status !== "completed") {
    const status = gatewayResult.status === "failed" ? "failed" : "review_required";
    const domRef = buildDomRef(
      input.prompt.promptId,
      input.jobId,
      gatewayResult.rawOutputRef,
    );
    const reason = gatewayResult.errorReason ?? `ai_gateway_${gatewayResult.status}`;
    completeCaptureFailure(input.captureStage, {
      status,
      reason,
      domRef,
      promptHash: input.promptHash,
      rawResponseHash: gatewayResult.rawOutputHash,
    });
    return buildGatewayFailure({
      stage: input.stage,
      status,
      promptHash: input.promptHash,
      rawResponseHash: gatewayResult.rawOutputHash,
      gatewayStatus: gatewayResult.status,
      reason,
    });
  }
  const domRef = buildDomRef(
    input.prompt.promptId,
    input.jobId,
    gatewayResult.rawOutputRef,
  );
  completeCaptureSuccess({
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: gatewayResult.rawOutputHash,
    domRef,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  }, input.captureStage);
  return { gatewayResult, domRef };
};

const handlePrimaryCaptureStages = async (
  input: CapturePromptOutputInput,
  startFields: ReturnType<typeof buildFlowStageStartFields>,
): Promise<CaptureSuccess | ReturnType<typeof buildGatewayFailure> | null> => {
  switch (input.stage) {
    case "DECOMPOSE_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "ANALYSIS_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    default:
      return null;
  }
};

const handleExtendedCaptureStages = async (
  input: CapturePromptOutputInput,
  startFields: ReturnType<typeof buildFlowStageStartFields>,
): Promise<CaptureSuccess | ReturnType<typeof buildGatewayFailure> | null> => {
  switch (input.stage) {
    case "FINAL_ADJUDICATION_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "HTML_REPORT_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "HTML_REPORT_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    default:
      return null;
  }
};

export const capturePromptOutput = async (
  input: CapturePromptOutputInput,
): Promise<CaptureSuccess | ReturnType<typeof buildGatewayFailure>> => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const startFields = buildFlowStageStartFields({
    traceContext: input.traceContext,
    preview: input.preview,
    hashes: { promptHash: input.promptHash },
  });
  const primaryResult = await handlePrimaryCaptureStages(input, startFields);
  if (primaryResult) {
    return primaryResult;
  }
  const extendedResult = await handleExtendedCaptureStages(input, startFields);
  if (extendedResult) {
    return extendedResult;
  }
  throw new Error(`Unsupported Deep Research capture stage ${input.stage}.`);
};
