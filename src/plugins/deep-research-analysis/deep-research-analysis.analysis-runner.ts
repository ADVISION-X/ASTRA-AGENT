import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createRuntimeEvent,
  createStageLogger,
} from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  createDeepResearchTraceContext,
  logDeepResearchJobStarted,
} from "./deep-research-analysis.logging.js";
import { createDeepResearchRecordStore } from "./deep-research-analysis.records.js";
import {
  DeepResearchInputSchema,
  type DeepResearchInput,
} from "./deep-research-analysis.schema.js";
import {
  type DeepResearchAnalysisContext,
  buildGatewaySender,
  ensureRuntimeContext,
  finishFailure,
} from "./deep-research-analysis.flow-shared.js";
import { type AnalysisExecutionContext } from "./deep-research-analysis.analysis-support.js";
import {
  completeSuccessfulRun,
  buildFinalPackageStage,
  runFinalReportPhase,
} from "./deep-research-analysis.analysis-finalization.js";
import { runBusinessDeckPhase } from "./deep-research-analysis.deck-stage.js";
import {
  runDecompositionPhase,
  runSubQuestionPhases,
} from "./deep-research-analysis.analysis-sub-questions.js";
import type { DeepResearchResult } from "./deep-research-analysis.result.js";

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
  const finalPackageStage = buildFinalPackageStage(executionContext);
  if (!finalPackageStage.ok) {
    return finalPackageStage.result;
  }
  const finalReport = await runFinalReportPhase(
    executionContext,
    finalPackageStage.finalPackage,
  );
  if (!finalReport.ok) {
    return finalReport.result;
  }
  const businessDeck = await runBusinessDeckPhase(
    executionContext,
    finalPackageStage.finalPackage,
    finalReport.finalReport,
  );
  if (!businessDeck.ok) {
    return businessDeck.result;
  }
  return await completeSuccessfulRun(
    executionContext,
    finalPackageStage.finalPackage,
    finalReport.finalReport,
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