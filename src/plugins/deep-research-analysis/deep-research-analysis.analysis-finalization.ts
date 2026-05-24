import { RuntimeFailureClass } from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import { exportDeepResearchArtifacts } from "./deep-research-analysis.export.js";
import { buildDeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import {
  logDeepResearchExportCompleted,
  logDeepResearchFinalPackageBuilt,
  logDeepResearchJobCompleted,
} from "./deep-research-analysis.logging.js";
import { parseDeepResearchFinalAdjudicationResponse } from "./deep-research-analysis.parser.js";
import {
  finalAdjudicationPrompt,
  renderDeepResearchFinalAdjudicationPrompt,
} from "./deep-research-analysis.prompts.js";
import { type DeepResearchFinalReport, type DeepResearchResult } from "./deep-research-analysis.result.js";
import {
  type FlowStageHandle,
  buildFlowStageStartFields,
  finishFailure,
} from "./deep-research-analysis.flow-shared.js";
import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import {
  finishPromptFailure,
  type AnalysisExecutionContext,
  type AnalysisFailure,
} from "./deep-research-analysis.analysis-support.js";

type FinalPackageSuccess = {
  ok: true;
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>;
};

type FinalReportSuccess = {
  ok: true;
  finalReport: DeepResearchFinalReport;
};

const readPayloadString = (
  payload: Record<string, unknown>,
  key: string,
): string | null => {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const readPayloadStringArray = (
  payload: Record<string, unknown>,
  key: string,
): string[] => {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const uniqueStrings = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];

const buildFinalAdjudicationFallback = (
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>,
) => {
  const fallback = {
    positiveReasons: uniqueStrings(
      finalPackage.analysisRecords.map((record) =>
        readPayloadString(record.parsedPayload, "coreFinding")
        ?? record.keyPoints[0]
        ?? record.answerText),
    ),
    strongestOpposingArguments: uniqueStrings(
      finalPackage.analysisRecords.flatMap((record) => [
        ...record.contradictionPoints,
        ...readPayloadStringArray(record.parsedPayload, "failureCases"),
      ]),
    ),
    evidenceGaps: uniqueStrings([
      ...finalPackage.missingAnalysisSubQuestionIds.map((subQuestionId) =>
        `Missing structured independent analysis record for ${subQuestionId}.`),
    ]),
    reverseConditions: uniqueStrings(
      finalPackage.analysisRecords.flatMap((record) => record.contradictionPoints),
    ),
    followUpSignals: uniqueStrings(
      finalPackage.analysisRecords.flatMap((record) => [
        ...readPayloadStringArray(record.parsedPayload, "uncertainties"),
        ...readPayloadStringArray(record.parsedPayload, "failureCases"),
      ]),
    ),
  };
  if (finalPackage.missingAnalysisSubQuestionIds.length === 0) {
    return fallback;
  }
  return {
    ...fallback,
    limitations: [`Structured independent analysis is incomplete for: ${finalPackage.missingAnalysisSubQuestionIds.join(", ")}.`],
  };
};

const failFinalPackageStage = (
  context: AnalysisExecutionContext,
  finalPackageStage: FlowStageHandle,
  reason: string,
): AnalysisFailure => {
  finalPackageStage.reviewRequired({
    reason,
    failureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
    retryable: false,
    terminal: true,
    recoveryPolicy: "review_required",
  });
  return {
    ok: false,
    result: finishFailure({
      store: context.store,
      runtimeLogger: context.runtimeLogger,
      traceContext: context.traceContext,
      jobId: context.jobId,
      status: "review_required",
      phase: "FINAL_PACKAGE_BUILD",
      reason,
      failureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
      recordHashes: context.recordHashes,
    }),
  };
};

const completeFinalPackageStage = (input: {
  context: AnalysisExecutionContext;
  finalPackageStage: FlowStageHandle;
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>;
}) => {
  const { finalPackageStage } = input;
  const finalPackageHash = stableJsonHash(input.finalPackage);
  logDeepResearchFinalPackageBuilt({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "FINAL_PACKAGE_BUILD",
    packageHash: finalPackageHash,
    recordHashCount: Object.keys(input.finalPackage.recordHashes).length,
    promptVersionCount: Object.keys(input.finalPackage.promptVersions).length,
  });
  finalPackageStage.complete({
    durationMs: Math.max(0, Date.now() - finalPackageStage.startedAt),
    hashes: { packageHash: finalPackageHash },
    metrics: {
      analysisRecordCount: input.finalPackage.analysisRecords.length,
      missingAnalysisCount: input.finalPackage.missingAnalysisSubQuestionIds.length,
      recordHashCount: Object.keys(input.finalPackage.recordHashes).length,
    },
  });
};

const runExportStage = (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>,
  finalReport: DeepResearchFinalReport,
) => {
  context.store.updateJobState({
    jobId: context.jobId,
    status: "running",
    phase: "EXPORT_REPORT",
  });
  const exportStage = context.stageLogger.start({
    ...buildFlowStageStartFields({
    traceContext: context.traceContext,
    preview: { jobId: context.jobId },
    }),
    stageName: "EXPORT_REPORT",
  });
  const exportArtifacts = exportDeepResearchArtifacts({
    dataDir: context.dataDir,
    store: context.store,
    jobId: context.jobId,
    finalPackage,
    finalReport,
  });
  logDeepResearchExportCompleted({
    logger: context.runtimeLogger,
    traceContext: context.traceContext,
    phase: "EXPORT_REPORT",
    exportDir: exportArtifacts.exportDir,
    finalReportHash: exportArtifacts.finalReportMarkdown.fileHash,
    researchBundleHash: exportArtifacts.researchBundle.fileHash,
    evidenceIndexHash: exportArtifacts.evidenceIndex.fileHash,
  });
  exportStage.complete({
    durationMs: Math.max(0, Date.now() - exportStage.startedAt),
    refs: { exportDir: exportArtifacts.exportDir },
    hashes: {
      finalReportHash: exportArtifacts.finalReportMarkdown.fileHash,
      researchBundleHash: exportArtifacts.researchBundle.fileHash,
      evidenceIndexHash: exportArtifacts.evidenceIndex.fileHash,
    },
  });
  return exportArtifacts;
};

const buildMergedRecordHashes = (input: {
  context: AnalysisExecutionContext;
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>;
  exportArtifacts: ReturnType<typeof exportDeepResearchArtifacts>;
  finalReportRecord: ReturnType<AnalysisExecutionContext["store"]["getLatestFinalReport"]>;
}) => ({
  ...input.finalPackage.recordHashes,
  ...input.context.recordHashes,
  exportFinalReportHash: input.exportArtifacts.finalReportMarkdown.fileHash,
  exportResearchBundleHash: input.exportArtifacts.researchBundle.fileHash,
  exportEvidenceIndexHash: input.exportArtifacts.evidenceIndex.fileHash,
  ...(input.finalReportRecord
    ? {
        [`finalReport:${input.finalReportRecord.id}`]:
          input.finalReportRecord.reportHash,
      }
    : {}),
});

const markJobCompleted = (input: {
  context: AnalysisExecutionContext;
  finalReport: DeepResearchFinalReport;
  mergedRecordHashes: Record<string, string>;
  finalReportRecord: ReturnType<AnalysisExecutionContext["store"]["getLatestFinalReport"]>;
}): DeepResearchResult => {
  input.context.store.updateJobState({
    jobId: input.context.jobId,
    status: "completed",
    phase: "COMPLETE",
    failureReason: null,
    reviewReason: null,
  });
  logDeepResearchJobCompleted({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "COMPLETE",
    reportHash: input.finalReportRecord
      ? input.finalReportRecord.reportHash
      : stableJsonHash(input.finalReport),
    recordHashCount: Object.keys(input.mergedRecordHashes).length,
  });
  return {
    jobId: input.context.jobId,
    status: "success",
    jobStatus: "completed",
    phase: "COMPLETE",
    report: input.finalReport,
    recordHashes: input.mergedRecordHashes,
    failureReason: null,
    reviewReason: null,
  };
};

export const buildFinalPackageStage = (
  context: AnalysisExecutionContext,
): FinalPackageSuccess | AnalysisFailure => {
  context.store.updateJobState({
    jobId: context.jobId,
    status: "running",
    phase: "FINAL_PACKAGE_BUILD",
  });
  const finalPackageStage = context.stageLogger.start({
    ...buildFlowStageStartFields({
    traceContext: context.traceContext,
    preview: { jobId: context.jobId },
    }),
    stageName: "FINAL_PACKAGE_BUILD",
  });
  let finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>;
  try {
    finalPackage = buildDeepResearchFinalPackage({
      store: context.store,
      jobId: context.jobId,
    });
  } catch (error) {
    return failFinalPackageStage(
      context,
      finalPackageStage,
      error instanceof Error ? error.message : "deep_research_final_package_build_failed",
    );
  }
  completeFinalPackageStage({
    context,
    finalPackageStage,
    finalPackage,
  });
  return { ok: true, finalPackage };
};

export const runFinalReportPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>,
): Promise<FinalReportSuccess | AnalysisFailure> => {
  const finalReport = await runPromptExchange<DeepResearchFinalReport>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: finalAdjudicationPrompt,
    promptKey: "final-adjudication",
    renderedPromptText: renderDeepResearchFinalAdjudicationPrompt({
      userQuestion: context.input.userQuestion,
      analysisGoal: context.input.analysisGoal,
      language: context.input.language,
      finalPackage,
    }),
    inputRefs: [`job:${context.jobId}:final-package`],
    maxInputChars: 45_000,
    stages: {
      send: "FINAL_ADJUDICATION_SEND",
      capture: "FINAL_ADJUDICATION_CAPTURE",
      parse: "FINAL_ADJUDICATION_PARSE",
      persist: "FINAL_ADJUDICATION_PERSIST",
    },
    parse: (rawText) =>
      parseDeepResearchFinalAdjudicationResponse(
        rawText,
        buildFinalAdjudicationFallback(finalPackage),
      ),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) => {
      const finalReportRecord = context.store.saveFinalReport({
        jobId: context.jobId,
        interactionId: interaction.id,
        report: parsed,
      });
      return {
        recordType: "final-report",
        recordId: finalReportRecord.id,
        count: 1,
      };
    },
  });
  if (finalReport.status !== "parsed") {
    return finishPromptFailure(context, finalReport);
  }
  return { ok: true, finalReport: finalReport.parsed };
};

export const completeSuccessfulRun = (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>,
  finalReport: DeepResearchFinalReport,
): DeepResearchResult => {
  const exportArtifacts = runExportStage(context, finalPackage, finalReport);
  const finalReportRecord = context.store.getLatestFinalReport(context.jobId);
  const mergedRecordHashes = buildMergedRecordHashes({
    context,
    finalPackage,
    exportArtifacts,
    finalReportRecord,
  });
  return markJobCompleted({
    context,
    finalReport,
    mergedRecordHashes,
    finalReportRecord,
  });
};