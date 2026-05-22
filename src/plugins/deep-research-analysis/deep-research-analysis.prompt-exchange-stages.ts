import {
  RuntimeFailureClass,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";
import {
  logDeepResearchDomCaptureCompleted,
  logDeepResearchDomCaptureStarted,
  logDeepResearchParseCompleted,
  logDeepResearchParseFailed,
  logDeepResearchPromptSent,
  logDeepResearchRecordPersisted,
} from "./deep-research-analysis.logging.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchParserResult } from "./deep-research-analysis.parser.js";
import {
  type DeepResearchRecordStore,
  type ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type DeepResearchGatewayPromptPackage,
  type DeepResearchGatewayResult,
  type DeepResearchGatewaySender,
  type ExchangePersistSummary,
  type PromptExchangeFailure,
  type PromptExchangeSuccess,
  type ProviderKind,
  type StageLogger,
  type StageTraceContext,
  rememberInteractionHashes,
  startFlowStage,
} from "./deep-research-analysis.flow-shared.js";

type SuccessfulParserResult<TParsed> = Extract<
  DeepResearchParserResult<TParsed>,
  { parseStatus: "parsed" }
>;

type PromptPreview = {
  promptId: string;
  promptVersion: string;
  subQuestionId?: string;
};

type CaptureSuccess = {
  gatewayResult: DeepResearchGatewayResult;
  domRef: string;
};

type ParseSuccess<TParsed> = {
  parsed: SuccessfulParserResult<TParsed>;
  recordCount: number;
};

const buildDomRef = (
  promptId: string,
  jobId: string,
  rawOutputRef: string | null,
): string => rawOutputRef ?? `artifact://deep-research/${jobId}/${promptId}`;

const buildGatewayFailure = (input: {
  stage: DeepResearchPhase;
  status: "failed" | "review_required";
  promptHash: string;
  rawResponseHash: string;
  gatewayStatus: DeepResearchGatewayResult["status"];
}): PromptExchangeFailure => ({
  status: input.status,
  phase: input.stage,
  reason: `ai_gateway_${input.gatewayStatus}`,
  failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
  promptHash: input.promptHash,
  rawResponseHash: input.rawResponseHash,
});

const completeCaptureFailure = (input: {
  captureStage: ReturnType<typeof startFlowStage>;
  status: "failed" | "review_required";
  reason: string;
  domRef: string;
  promptHash: string;
  rawResponseHash: string;
}) => {
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
    input.captureStage.fail(terminalInput);
    return;
  }
  input.captureStage.reviewRequired(terminalInput);
};

const completeCaptureSuccess = (input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  captureStage: ReturnType<typeof startFlowStage>;
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  domRef: string;
  subQuestionId?: string;
}) => {
  logDeepResearchDomCaptureCompleted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: input.rawResponseHash,
    domRef: input.domRef,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  input.captureStage.complete({
    refs: { domRef: input.domRef },
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
  });
};

const buildParseFailure = (input: {
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

const completeParseFailure = (input: {
  parseStage: ReturnType<typeof startFlowStage>;
  status: "failed" | "review_required";
  reason: string;
  promptHash: string;
  rawResponseHash: string;
}) => {
  const terminalInput = {
    reason: input.reason,
    failureClass: RuntimeFailureClass.AI_PARSE_FAILURE,
    retryable: false,
    terminal: true,
    recoveryPolicy: "review_required" as const,
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
  };
  if (input.status === "failed") {
    input.parseStage.fail(terminalInput);
    return;
  }
  input.parseStage.reviewRequired(terminalInput);
};

const completeParseSuccess = (input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  parseStage: ReturnType<typeof startFlowStage>;
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  recordCount: number;
  subQuestionId?: string;
}) => {
  logDeepResearchParseCompleted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    rawResponseHash: input.rawResponseHash,
    parseStatus: "parsed",
    recordCount: input.recordCount,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  input.parseStage.complete({
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
    metrics: { recordCount: input.recordCount },
  });
};

const createInteractionRecord = <TParsed>(input: {
  store: DeepResearchRecordStore;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
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
    domRef: input.domRef,
    rawResponseText: input.gatewayResult.normalizedText,
    rawResponseHash: input.parsed.rawResponseHash,
    normalizedText: input.parsed.normalizedText,
    parseStatus: input.parsed.parseStatus,
    providerKind: input.providerKind,
    providerProofJson: input.gatewayResult.providerProofJson,
  });

const completePersistSuccess = (input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  persistStage: ReturnType<typeof startFlowStage>;
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  persistSummary: ExchangePersistSummary;
  subQuestionId?: string;
}) => {
  logDeepResearchRecordPersisted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    recordType: input.persistSummary.recordType,
    recordId: input.persistSummary.recordId,
    count: input.persistSummary.count,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    promptHash: input.promptHash,
    rawResponseHash: input.rawResponseHash,
  });
  input.persistStage.complete({
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
    metrics: { count: input.persistSummary.count },
    preview: {
      recordType: input.persistSummary.recordType,
      recordId: input.persistSummary.recordId,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    },
  });
};

export const capturePromptOutput = async (input: {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  jobId: string;
  prompt: DeepResearchPrompt;
  promptPackage: DeepResearchGatewayPromptPackage;
  promptHash: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  subQuestionId?: string;
}): Promise<CaptureSuccess | PromptExchangeFailure> => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const captureStage = startFlowStage({
    stageLogger: input.stageLogger,
    traceContext: input.traceContext,
    stageName: input.stage,
    preview: input.preview,
    hashes: { promptHash: input.promptHash },
  });
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
    completeCaptureFailure({
      captureStage,
      status,
      reason: `ai_gateway_${gatewayResult.status}`,
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
    captureStage,
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: gatewayResult.rawOutputHash,
    domRef,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  return { gatewayResult, domRef };
};

export const parsePromptOutput = <TParsed>(input: {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  jobId: string;
  promptHash: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  gatewayResult: DeepResearchGatewayResult;
  subQuestionId?: string;
  parse: (rawText: string) => DeepResearchParserResult<TParsed>;
  successRecordCount: (parsed: TParsed) => number;
}): ParseSuccess<TParsed> | PromptExchangeFailure => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const parseStage = startFlowStage({
    stageLogger: input.stageLogger,
    traceContext: input.traceContext,
    stageName: input.stage,
    preview: input.preview,
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.gatewayResult.rawOutputHash,
    },
  });
  const parsed = input.parse(input.gatewayResult.normalizedText);
  if (parsed.parseStatus !== "parsed") {
    logDeepResearchParseFailed({
      logger: input.runtimeLogger,
      traceContext: input.traceContext,
      phase: input.stage,
      rawResponseHash: parsed.rawResponseHash,
      reason: parsed.reason,
      failureClass: RuntimeFailureClass.AI_PARSE_FAILURE,
      parseStatus: parsed.parseStatus,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    });
    const status = parsed.parseStatus === "failed" ? "failed" : "review_required";
    completeParseFailure({
      parseStage,
      status,
      reason: parsed.reason,
      promptHash: input.promptHash,
      rawResponseHash: parsed.rawResponseHash,
    });
    return buildParseFailure({
      stage: input.stage,
      promptHash: input.promptHash,
      rawResponseHash: parsed.rawResponseHash,
      reason: parsed.reason,
      status,
    });
  }
  const recordCount = input.successRecordCount(parsed.parsed);
  completeParseSuccess({
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    parseStage,
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: parsed.rawResponseHash,
    recordCount,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  return { parsed, recordCount };
};

export const persistPromptOutput = <TParsed>(input: {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  recordHashes: Record<string, string>;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
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
}): PromptExchangeSuccess<TParsed> => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const persistStage = startFlowStage({
    stageLogger: input.stageLogger,
    traceContext: input.traceContext,
    stageName: input.stage,
    preview: input.preview,
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.parsed.rawResponseHash,
    },
  });
  const interaction = createInteractionRecord({
    store: input.store,
    jobId: input.jobId,
    providerKind: input.providerKind,
    prompt: input.prompt,
    promptHash: input.promptHash,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    domRef: input.domRef,
    gatewayResult: input.gatewayResult,
    parsed: input.parsed,
  });
  rememberInteractionHashes(input.recordHashes, interaction);
  const persistSummary = input.persist({
    interaction,
    parsed: input.parsed.parsed,
  });
  completePersistSuccess({
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    persistStage,
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: input.parsed.rawResponseHash,
    persistSummary,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  return {
    status: "parsed",
    interaction,
    parsed: input.parsed.parsed,
    promptHash: input.promptHash,
    rawResponseHash: input.parsed.rawResponseHash,
  };
};