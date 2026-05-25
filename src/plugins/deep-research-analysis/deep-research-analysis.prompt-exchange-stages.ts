import {
  RuntimeFailureClass,
} from "../../lib/runtime-logs/index.js";
import {
  logDeepResearchParseFailed,
  logDeepResearchParseCompleted,
  logDeepResearchRecordPersisted,
} from "./deep-research-analysis.logging.js";
import { isDeepResearchParserSuccess } from "./deep-research-analysis.parser.js";
import {
  type FlowStageHandle,
  type PromptExchangeFailure,
  buildFlowStageStartFields,
  rememberInteractionHashes,
} from "./deep-research-analysis.flow-shared.js";
import {
  type ParsePromptOutputInput,
  type ParseSuccess,
  type SuccessfulParserResult,
  buildParseFailure,
  createFailedInteractionRecord,
} from "./deep-research-analysis.prompt-exchange-stage-support.js";

const completeParseFailure = (parseStage: FlowStageHandle, input: {
  status: "failed" | "review_required";
  reason: string;
  promptHash: string;
  rawResponseHash: string;
}): void => {
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

const completeParseSuccess = <TParsed>(input: {
  parseStatus: SuccessfulParserResult<TParsed>["parseStatus"];
  recordCount: number;
  subQuestionId?: string;
} & Pick<ParsePromptOutputInput<TParsed>, "runtimeLogger" | "traceContext" | "stage" | "promptHash"> & {
  rawResponseHash: string;
}, parseStage: FlowStageHandle): void => {
  logDeepResearchParseCompleted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    rawResponseHash: input.rawResponseHash,
    parseStatus: input.parseStatus,
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

const continueParsePromptOutput = <TParsed>(
  input: ParsePromptOutputInput<TParsed> & { parseStage: FlowStageHandle },
): ParseSuccess<TParsed> | PromptExchangeFailure => {
  const parsed = input.parse(input.gatewayResult.normalizedText);
  if (!isDeepResearchParserSuccess(parsed)) {
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
    const status = parsed.parseStatus === "failed" || parsed.parseStatus === "failed_empty"
      ? "failed"
      : "review_required";
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
    parseStatus: parsed.parseStatus,
    recordCount,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  }, input.parseStage);
  return { parsed: parsed as SuccessfulParserResult<TParsed>, recordCount };
};

const handlePrimaryParseStages = <TParsed>(
  input: ParsePromptOutputInput<TParsed>,
  startFields: ReturnType<typeof buildFlowStageStartFields>,
): ParseSuccess<TParsed> | PromptExchangeFailure | null => {
  switch (input.stage) {
    case "DECOMPOSE_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "ANALYSIS_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    default:
      return null;
  }
};

const handleExtendedParseStages = <TParsed>(
  input: ParsePromptOutputInput<TParsed>,
  startFields: ReturnType<typeof buildFlowStageStartFields>,
): ParseSuccess<TParsed> | PromptExchangeFailure | null => {
  switch (input.stage) {
    case "FINAL_ADJUDICATION_PARSE": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_PARSE" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    case "HTML_REPORT_DETECT": {
      const parseStage = input.stageLogger.start({ ...startFields, stageName: "HTML_REPORT_DETECT" });
      return continueParsePromptOutput({ ...input, parseStage });
    }
    default:
      return null;
  }
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
  const primaryResult = handlePrimaryParseStages(input, startFields);
  if (primaryResult) {
    return primaryResult;
  }
  const extendedResult = handleExtendedParseStages(input, startFields);
  if (extendedResult) {
    return extendedResult;
  }
  throw new Error(`Unsupported Deep Research parse stage ${input.stage}.`);
};
