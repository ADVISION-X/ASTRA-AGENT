import { RuntimeFailureClass, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
    type DeepResearchGatewaySender,
    type DeepResearchGatewayInputRef,
    type ExchangePersistSummary,
    type PromptExchangeFailure,
    type PromptExchangeSuccess,
    type ProviderKind,
    type StageLogger,
    type StageTraceContext,
    buildFlowStageStartFields,
} from "./deep-research-analysis.analysis-runner.js";
import { buildPromptPackage } from "./deep-research-analysis.gateway.js";
import { logDeepResearchPromptSent } from "./deep-research-analysis.logging.js";
import type { DeepResearchParserResult } from "./deep-research-analysis.parser.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-bundle-shell.js";
import type { CaptureSuccess } from "./deep-research-analysis.prompt-exchange-capture-stage.js";
import {
    capturePromptOutput,
    throwUnsupportedPromptExchangeStage,
} from "./deep-research-analysis.prompt-exchange-capture-stage.js";
import type { ParseRawAvailable } from "./deep-research-analysis.prompt-exchange-persist-stage.js";
import { parsePromptOutput, persistPromptOutput } from "./deep-research-analysis.prompt-exchange-persist-stage.js";
import { buildRenderedDeepResearchPromptHash } from "./deep-research-analysis.prompts.js";
import {
    type DeepResearchRecordStore,
    type ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import { awaitDeepResearchSafePoint } from "./deep-research-analysis.intervention.js";

type PromptPreview = {
  promptId: string;
  promptVersion: string;
  subQuestionId?: string;
};

type PromptExchangeInput<TParsed> = {
  dataDir: string;
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  releaseForTakeover: () => Promise<void>;
  recordHashes: Record<string, string>;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptKey: string;
  renderedPromptText: string;
  inputRefs: DeepResearchGatewayInputRef[];
  stages: {
    send: DeepResearchPhase;
    capture: DeepResearchPhase;
    parse: DeepResearchPhase;
    persist: DeepResearchPhase;
  };
  subQuestionId?: string;
  timeoutMs?: number;
  maxInputChars?: number;
  maxFileCount?: number;
  parse: (rawText: string) => DeepResearchParserResult<TParsed>;
  successRecordCount: (parsed: TParsed) => number;
  persist: (input: {
    interaction: ResearchInteraction;
    parsed: TParsed;
  }) => ExchangePersistSummary;
};

export type PromptExchangeRawAvailable = PromptExchangeFailure & {
  status: "review_required";
  phase: "ANALYSIS_PARSE";
  interaction: ParseRawAvailable["interaction"];
  parseStatus: ParseRawAvailable["parseStatus"];
  rawAvailableForCaseFile: true;
  rawResponseHash: string;
};

const buildPromptPreview = (
  prompt: DeepResearchPrompt,
  subQuestionId?: string,
): PromptPreview => ({
  promptId: prompt.promptId,
  promptVersion: prompt.promptVersion,
  ...(subQuestionId ? { subQuestionId } : {}),
});

const finishStartedPromptSend = (sendStage: ReturnType<StageLogger["start"]>, input: {
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stage: DeepResearchPhase;
  prompt: DeepResearchPrompt;
  promptHash: string;
  subQuestionId?: string;
}) => {
  try {
    logDeepResearchPromptSent({
      logger: input.runtimeLogger,
      traceContext: input.traceContext,
      phase: input.stage,
      promptId: input.prompt.promptId,
      promptVersion: input.prompt.promptVersion,
      promptHash: input.promptHash,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    });
    sendStage.complete({
      durationMs: Math.max(0, Date.now() - sendStage.startedAt),
      hashes: { promptHash: input.promptHash },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "deep_research_prompt_send_stage_failed";
    sendStage.fail({
      reason,
      failureClass: RuntimeFailureClass.INTERNAL_BUG,
      retryable: false,
      terminal: false,
      recoveryPolicy: "review_required",
      durationMs: Math.max(0, Date.now() - sendStage.startedAt),
      hashes: { promptHash: input.promptHash },
    });
    throw error;
  }
};

const handlePrimarySendStages = (input: {
  stageLogger: StageLogger;
  startFields: ReturnType<typeof buildFlowStageStartFields>;
  stage: DeepResearchPhase;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  prompt: DeepResearchPrompt;
  promptHash: string;
  subQuestionId?: string;
}): boolean => {
  switch (input.stage) {
    case "DECOMPOSE_SEND": {
      const sendStage = input.stageLogger.start({ ...input.startFields, stageName: "DECOMPOSE_SEND" });
      finishStartedPromptSend(sendStage, input);
      return true;
    }
    case "ANALYSIS_SEND": {
      const sendStage = input.stageLogger.start({ ...input.startFields, stageName: "ANALYSIS_SEND" });
      finishStartedPromptSend(sendStage, input);
      return true;
    }
    default:
      return false;
  }
};

const handleExtendedSendStages = (input: {
  stageLogger: StageLogger;
  startFields: ReturnType<typeof buildFlowStageStartFields>;
  stage: DeepResearchPhase;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  prompt: DeepResearchPrompt;
  promptHash: string;
  subQuestionId?: string;
}): boolean => {
  switch (input.stage) {
    case "FINAL_ADJUDICATION_SEND": {
      const sendStage = input.stageLogger.start({ ...input.startFields, stageName: "FINAL_ADJUDICATION_SEND" });
      finishStartedPromptSend(sendStage, input);
      return true;
    }
    case "HTML_REPORT_SEND": {
      const sendStage = input.stageLogger.start({ ...input.startFields, stageName: "HTML_REPORT_SEND" });
      finishStartedPromptSend(sendStage, input);
      return true;
    }
    default:
      return false;
  }
};

const startPromptSend = (input: {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  jobId: string;
  stage: DeepResearchPhase;
  preview: PromptPreview;
  prompt: DeepResearchPrompt;
  promptHash: string;
  subQuestionId?: string;
}) => {
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
  const sharedInput = {
    stageLogger: input.stageLogger,
    startFields,
    stage: input.stage,
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    prompt: input.prompt,
    promptHash: input.promptHash,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  };
  if (handlePrimarySendStages(sharedInput) || handleExtendedSendStages(sharedInput)) {
    return;
  }
  return throwUnsupportedPromptExchangeStage(input, "send");
};

const preparePromptExchange = <TParsed>(input: PromptExchangeInput<TParsed>) => {
  const promptHash = buildRenderedDeepResearchPromptHash({
    prompt: input.prompt,
    renderedPromptText: input.renderedPromptText,
  });
  return {
    promptHash,
    promptPackage: buildPromptPackage({
      jobId: input.jobId,
      prompt: input.prompt,
      promptKey: input.promptKey,
      renderedPromptText: input.renderedPromptText,
      promptHash,
      providerKind: input.providerKind,
      inputRefs: input.inputRefs,
      ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      ...(input.maxInputChars ? { maxInputChars: input.maxInputChars } : {}),
      ...(typeof input.maxFileCount === "number" ? { maxFileCount: input.maxFileCount } : {}),
    }),
    preview: buildPromptPreview(input.prompt, input.subQuestionId),
  };
};

const buildSharedStageInput = <TParsed>(
  input: PromptExchangeInput<TParsed>,
  prepared: Pick<ReturnType<typeof preparePromptExchange<TParsed>>, "promptHash" | "preview">,
) => ({
  store: input.store,
  runtimeLogger: input.runtimeLogger,
  traceContext: input.traceContext,
  stageLogger: input.stageLogger,
  recordHashes: input.recordHashes,
  jobId: input.jobId,
  providerKind: input.providerKind,
  prompt: input.prompt,
  promptHash: prepared.promptHash,
  renderedPromptText: input.renderedPromptText,
  preview: prepared.preview,
  ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
});

const continuePromptExchange = <TParsed>(
  input: PromptExchangeInput<TParsed>,
  prepared: Pick<ReturnType<typeof preparePromptExchange<TParsed>>, "promptHash" | "preview">,
  captured: CaptureSuccess,
): PromptExchangeSuccess<TParsed> | PromptExchangeRawAvailable | PromptExchangeFailure => {
  const stageInput = buildSharedStageInput(input, prepared);
  const parsed = parsePromptOutput({
    ...stageInput,
    stage: input.stages.parse,
    domRef: captured.domRef,
    gatewayResult: captured.gatewayResult,
    parse: input.parse,
    successRecordCount: input.successRecordCount,
  });
  if ("status" in parsed) {
    if (parsed.status === "raw_available") {
      return {
        status: "review_required",
        phase: "ANALYSIS_PARSE",
        failureClass: RuntimeFailureClass.AI_PARSE_FAILURE,
        interaction: parsed.interaction,
        reason: parsed.reason,
        parseStatus: parsed.parseStatus,
        rawAvailableForCaseFile: true,
        promptHash: prepared.promptHash,
        rawResponseHash: parsed.rawResponseHash,
      };
    }
    return parsed;
  }
  return persistPromptOutput({
    ...stageInput,
    stage: input.stages.persist,
    domRef: captured.domRef,
    gatewayResult: captured.gatewayResult,
    parsed: parsed.parsed,
    persist: input.persist,
  });
};

export const runPromptExchange = async <TParsed>(
  input: PromptExchangeInput<TParsed>,
): Promise<PromptExchangeSuccess<TParsed> | PromptExchangeRawAvailable | PromptExchangeFailure> => {
  const prepared = preparePromptExchange(input);

  await awaitDeepResearchSafePoint(input.dataDir, input.jobId, `${input.stages.send}:before`, input.releaseForTakeover);

  startPromptSend({
    store: input.store,
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stageLogger: input.stageLogger,
    jobId: input.jobId,
    stage: input.stages.send,
    preview: prepared.preview,
    prompt: input.prompt,
    promptHash: prepared.promptHash,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  const captured = await capturePromptOutput({
    store: input.store,
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stageLogger: input.stageLogger,
    sender: input.sender,
    jobId: input.jobId,
    prompt: input.prompt,
    promptPackage: prepared.promptPackage,
    promptHash: prepared.promptHash,
    renderedPromptText: input.renderedPromptText,
    preview: prepared.preview,
    stage: input.stages.capture,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  if ("status" in captured) {
    return captured;
  }

  await awaitDeepResearchSafePoint(input.dataDir, input.jobId, `${input.stages.capture}:checkpointed`, input.releaseForTakeover);

  return continuePromptExchange(input, prepared, captured);
};

export {
    persistAnalysisAnswer
} from "./deep-research-analysis.analysis-sub-questions.js";
