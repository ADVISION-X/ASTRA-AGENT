import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { logDeepResearchPromptSent } from "./deep-research-analysis.logging.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchParserResult } from "./deep-research-analysis.parser.js";
import {
  type DeepResearchRecordStore,
  type ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type DeepResearchGatewaySender,
  type ExchangePersistSummary,
  type PromptExchangeFailure,
  type PromptExchangeSuccess,
  type ProviderKind,
  type StageLogger,
  type StageTraceContext,
  buildFlowStageStartFields,
  buildPromptPackage,
} from "./deep-research-analysis.flow-shared.js";
import { buildRenderedDeepResearchPromptHash } from "./deep-research-analysis.prompts.js";
import {
  capturePromptOutput,
  parsePromptOutput,
  persistPromptOutput,
} from "./deep-research-analysis.prompt-exchange-stages.js";

type PromptPreview = {
  promptId: string;
  promptVersion: string;
  subQuestionId?: string;
};

type PromptExchangeInput<TParsed> = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  recordHashes: Record<string, string>;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptKey: string;
  renderedPromptText: string;
  inputRefs: string[];
  stages: {
    send: DeepResearchPhase;
    capture: DeepResearchPhase;
    parse: DeepResearchPhase;
    persist: DeepResearchPhase;
  };
  subQuestionId?: string;
  maxInputChars?: number;
  parse: (rawText: string) => DeepResearchParserResult<TParsed>;
  successRecordCount: (parsed: TParsed) => number;
  persist: (input: {
    interaction: ResearchInteraction;
    parsed: TParsed;
  }) => ExchangePersistSummary;
};

const buildPromptPreview = (
  prompt: DeepResearchPrompt,
  subQuestionId?: string,
): PromptPreview => ({
  promptId: prompt.promptId,
  promptVersion: prompt.promptVersion,
  ...(subQuestionId ? { subQuestionId } : {}),
});

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
  const completeSendStage = (sendStage: ReturnType<StageLogger["start"]>): void => {
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
  };
  switch (input.stage) {
    case "DECOMPOSE_SEND": {
      const sendStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_SEND" });
      completeSendStage(sendStage);
      return;
    }
    case "POSITIVE_SEND": {
      const sendStage = input.stageLogger.start({ ...startFields, stageName: "POSITIVE_SEND" });
      completeSendStage(sendStage);
      return;
    }
    case "FALSIFY_SEND": {
      const sendStage = input.stageLogger.start({ ...startFields, stageName: "FALSIFY_SEND" });
      completeSendStage(sendStage);
      return;
    }
    case "FINAL_SEND": {
      const sendStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_SEND" });
      completeSendStage(sendStage);
      return;
    }
    default:
      throw new Error(`Unsupported Deep Research send stage ${input.stage}.`);
  }
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
      ...(input.maxInputChars ? { maxInputChars: input.maxInputChars } : {}),
    }),
    preview: buildPromptPreview(input.prompt, input.subQuestionId),
  };
};

export const runPromptExchange = async <TParsed>(
  input: PromptExchangeInput<TParsed>,
): Promise<PromptExchangeSuccess<TParsed> | PromptExchangeFailure> => {
  const { promptHash, promptPackage, preview } = preparePromptExchange(input);

  startPromptSend({
    store: input.store,
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stageLogger: input.stageLogger,
    jobId: input.jobId,
    stage: input.stages.send,
    preview,
    prompt: input.prompt,
    promptHash,
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
    promptPackage,
    promptHash,
    preview,
    stage: input.stages.capture,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  if ("status" in captured) {
    return captured;
  }

  const parsed = parsePromptOutput({
    store: input.store,
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stageLogger: input.stageLogger,
    jobId: input.jobId,
    promptHash,
    preview,
    stage: input.stages.parse,
    gatewayResult: captured.gatewayResult,
    parse: input.parse,
    successRecordCount: input.successRecordCount,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  if ("status" in parsed) {
    return parsed;
  }

  return persistPromptOutput({
    store: input.store,
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stageLogger: input.stageLogger,
    recordHashes: input.recordHashes,
    jobId: input.jobId,
    providerKind: input.providerKind,
    prompt: input.prompt,
    promptHash,
    preview,
    stage: input.stages.persist,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    domRef: captured.domRef,
    gatewayResult: captured.gatewayResult,
    parsed: parsed.parsed,
    persist: input.persist,
  });
};