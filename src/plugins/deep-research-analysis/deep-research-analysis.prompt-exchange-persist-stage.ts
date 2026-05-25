import { logDeepResearchRecordPersisted } from "./deep-research-analysis.logging.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type FlowStageHandle,
  buildFlowStageStartFields,
  rememberInteractionHashes,
} from "./deep-research-analysis.flow-shared.js";
import {
  type PersistPromptOutputInput,
  createInteractionRecord,
} from "./deep-research-analysis.prompt-exchange-stage-support.js";

const completePersistSuccess = <TParsed>(input: {
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  subQuestionId?: string;
  persistSummary: ReturnType<PersistPromptOutputInput<TParsed>["persist"]>;
} & Pick<PersistPromptOutputInput<TParsed>, "runtimeLogger" | "traceContext">, persistStage: FlowStageHandle): void => {
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

const continuePersistPromptOutput = <TParsed>(
  input: PersistPromptOutputInput<TParsed> & { persistStage: FlowStageHandle },
) => {
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
    status: "parsed" as const,
    interaction,
    parsed: input.parsed.parsed,
    promptHash: input.promptHash,
    rawResponseHash: input.parsed.rawResponseHash,
  };
};

const handlePrimaryPersistStages = <TParsed>(
  input: PersistPromptOutputInput<TParsed>,
  startFields: ReturnType<typeof buildFlowStageStartFields>,
) => {
  switch (input.stage) {
    case "DECOMPOSE_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "ANALYSIS_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    default:
      return null;
  }
};

const handleExtendedPersistStages = <TParsed>(
  input: PersistPromptOutputInput<TParsed>,
  startFields: ReturnType<typeof buildFlowStageStartFields>,
) => {
  switch (input.stage) {
    case "FINAL_ADJUDICATION_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    case "HTML_REPORT_PERSIST": {
      const persistStage = input.stageLogger.start({ ...startFields, stageName: "HTML_REPORT_PERSIST" });
      return continuePersistPromptOutput({ ...input, persistStage });
    }
    default:
      return null;
  }
};

export const persistPromptOutput = <TParsed>(
  input: PersistPromptOutputInput<TParsed>,
) => {
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
  const primaryResult = handlePrimaryPersistStages(input, startFields);
  if (primaryResult) {
    return primaryResult;
  }
  const extendedResult = handleExtendedPersistStages(input, startFields);
  if (extendedResult) {
    return extendedResult;
  }
  throw new Error(`Unsupported Deep Research persist stage ${input.stage}.`);
};
