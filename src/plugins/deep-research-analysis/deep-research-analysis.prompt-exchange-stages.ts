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
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type ExchangePersistSummary,
  type FlowStageHandle,
  type PromptExchangeFailure,
  type PromptExchangeSuccess,
  type StageTraceContext,
  buildFlowStageStartFields,
  rememberInteractionHashes,
} from "./deep-research-analysis.flow-shared.js";
import {
  type CapturePromptOutputInput,
  type CaptureSuccess,
  type ParsePromptOutputInput,
  type ParseSuccess,
  type PersistPromptOutputInput,
  type SuccessfulParserResult,
  buildDomRef,
  buildGatewayFailure,
  buildParseFailure,
  createFailedInteractionRecord,
  createInteractionRecord,
} from "./deep-research-analysis.prompt-exchange-stage-support.js";

const completeCaptureFailure = (captureStage: FlowStageHandle, input: {
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
    captureStage.fail(terminalInput);
    return;
  }
  captureStage.reviewRequired(terminalInput);
};

const completeCaptureSuccess = (input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  domRef: string;
  subQuestionId?: string;
}, captureStage: FlowStageHandle) => {
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

const completeParseFailure = (parseStage: FlowStageHandle, input: {
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
    parseStage.fail(terminalInput);
    return;
  }
  parseStage.reviewRequired(terminalInput);
};

const completeParseSuccess = (input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  recordCount: number;
  subQuestionId?: string;
}, parseStage: FlowStageHandle) => {
  logDeepResearchParseCompleted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    rawResponseHash: input.rawResponseHash,
    parseStatus: "parsed",
    recordCount: input.recordCount,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  parseStage.complete({
    durationMs: Math.max(0, Date.now() - parseStage.startedAt),
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
    metrics: { recordCount: input.recordCount },
  });
};

const completePersistSuccess = (input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  persistSummary: ExchangePersistSummary;
  subQuestionId?: string;
}, persistStage: FlowStageHandle) => {
  logDeepResearchRecordPersisted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    recordType: input.persistSummary.recordType,
    recordId: input.persistSummary.recordId,
    ...(input.persistSummary.recordIds ? { recordIds: input.persistSummary.recordIds } : {}),
    count: input.persistSummary.count,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    promptHash: input.promptHash,
    rawResponseHash: input.rawResponseHash,
  });
  persistStage.complete({
    durationMs: Math.max(0, Date.now() - persistStage.startedAt),
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
    metrics: { count: input.persistSummary.count },
    preview: {
      recordType: input.persistSummary.recordType,
      recordId: input.persistSummary.recordId,
      firstRecordId: input.persistSummary.recordIds?.[0] ?? input.persistSummary.recordId,
      recordCount: String(input.persistSummary.count),
      ...(input.persistSummary.recordIds && input.persistSummary.recordIds.length > 1
        ? { recordIds: input.persistSummary.recordIds.join(",") }
        : {}),
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    },
  });
};

const continueCapturePromptOutput = async (
  input: CapturePromptOutputInput & { captureStage: FlowStageHandle },
): Promise<CaptureSuccess | PromptExchangeFailure> => {
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

export const capturePromptOutput = async (
  input: CapturePromptOutputInput,
): Promise<CaptureSuccess | PromptExchangeFailure> => {
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
  switch (input.stage) {
    case "DECOMPOSE_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "ANALYSIS_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "POSITIVE_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "POSITIVE_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "FALSIFY_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FALSIFY_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "FINAL_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "FINAL_ADJUDICATION_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "DECK_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECK_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "DECK_PPT_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECK_PPT_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    default:
      throw new Error(`Unsupported Deep Research capture stage ${input.stage}.`);
  }
};

const continueParsePromptOutput = <TParsed>(
  input: ParsePromptOutputInput<TParsed> & { parseStage: FlowStageHandle },
): ParseSuccess<TParsed> | PromptExchangeFailure => {
  const parsed = input.parse(input.gatewayResult.normalizedText);
  if (parsed.parseStatus !== "parsed") {
    const interaction = createFailedInteractionRecord({
      store: input.store,
      jobId: input.jobId,
      providerKind: input.providerKind,
      prompt: input.prompt,
      promptHash: input.promptHash,
      renderedPromptText: input.renderedPromptText,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
      domRef: input.domRef,
      gatewayResult: input.gatewayResult,
      parsed,
    });
    rememberInteractionHashes(input.recordHashes, interaction);
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
    logDeepResearchRecordPersisted({
      logger: input.runtimeLogger,
      traceContext: input.traceContext,
      phase: input.stage,
      recordType: "interaction",
      recordId: interaction.id,
      count: 1,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
      promptHash: input.promptHash,
      rawResponseHash: parsed.rawResponseHash,
    });
    const status = parsed.parseStatus === "failed" ? "failed" : "review_required";
    completeParseFailure(input.parseStage, {
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
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: parsed.rawResponseHash,
    recordCount,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  }, input.parseStage);
  return { parsed, recordCount };
};

export const parsePromptOutput = <TParsed>(
  input: ParsePromptOutputInput<TParsed>,
): ParseSuccess<TParsed> | PromptExchangeFailure => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const startFields = buildFlowStageStartFields({
    traceContext: input.traceContext,
    preview: input.preview,
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.gatewayResult.rawOutputHash,
    },
  });
  switch (input.stage) {
    case "DECOMPOSE_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "ANALYSIS_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "POSITIVE_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "POSITIVE_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "FALSIFY_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "FALSIFY_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "FINAL_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "FINAL_ADJUDICATION_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "DECK_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "DECK_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "DECK_PPT_ARTIFACT_DETECT": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "DECK_PPT_ARTIFACT_DETECT" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    default:
      throw new Error(`Unsupported Deep Research parse stage ${input.stage}.`);
  }
};

const continuePersistPromptOutput = <TParsed>(
  input: PersistPromptOutputInput<TParsed> & { persistStage: FlowStageHandle },
): PromptExchangeSuccess<TParsed> => {
  const interaction = createInteractionRecord({
    store: input.store,
    jobId: input.jobId,
    providerKind: input.providerKind,
    prompt: input.prompt,
    promptHash: input.promptHash,
    renderedPromptText: input.renderedPromptText,
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
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: input.parsed.rawResponseHash,
    persistSummary,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  }, input.persistStage);
  return {
    status: "parsed",
    interaction,
    parsed: input.parsed.parsed,
    promptHash: input.promptHash,
    rawResponseHash: input.parsed.rawResponseHash,
  };
};

export const persistPromptOutput = <TParsed>(
  input: PersistPromptOutputInput<TParsed>,
): PromptExchangeSuccess<TParsed> => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const startFields = buildFlowStageStartFields({
    traceContext: input.traceContext,
    preview: input.preview,
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.parsed.rawResponseHash,
    },
  });
  switch (input.stage) {
    case "DECOMPOSE_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "ANALYSIS_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "POSITIVE_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "POSITIVE_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "FALSIFY_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "FALSIFY_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "FINAL_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "FINAL_ADJUDICATION_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "DECK_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "DECK_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "DECK_PPT_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "DECK_PPT_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    default:
      throw new Error(`Unsupported Deep Research persist stage ${input.stage}.`);
  }
};
