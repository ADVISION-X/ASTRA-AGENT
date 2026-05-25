import { RuntimeFailureClass } from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import { exportDeepResearchArtifacts } from "./deep-research-analysis.export.js";
import { buildDeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import { renderDeepResearchFullCaseFileMarkdown } from "./deep-research-analysis.full-case-file-render.js";
import { buildDeepResearchStructuredIndex } from "./deep-research-analysis.final-package.js";
import {
  logDeepResearchExportCompleted,
  logDeepResearchStructuredIndexBuilt,
  logDeepResearchJobCompleted,
} from "./deep-research-analysis.logging.js";
import { parseDeepResearchFinalAdjudicationResponse } from "./deep-research-analysis.parser.js";
import {
  finalAdjudicationShellPrompt,
  renderDeepResearchFinalAdjudicationPrompt,
} from "./deep-research-analysis.final-adjudication-prompt.js";
import { type DeepResearchFinalReport, type DeepResearchResult } from "./deep-research-analysis.result.js";
import { mergeDeepResearchFinalReportSourceNotes } from "./deep-research-analysis.source-notes.js";
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
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  fullCaseFileMarkdown: string;
};

type FinalReportSuccess = {
  ok: true;
  finalReport: DeepResearchFinalReport;
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
      phase: "FULL_CASE_FILE_BUILD",
      reason,
      failureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
      recordHashes: context.recordHashes,
    }),
  };
};

const completeFinalPackageStage = (input: {
  context: AnalysisExecutionContext;
  finalPackageStage: FlowStageHandle;
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
}) => {
  const { finalPackageStage } = input;
  const finalPackageHash = stableJsonHash(input.finalPackage);
  logDeepResearchStructuredIndexBuilt({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "FULL_CASE_FILE_BUILD",
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
      rawAnalysisCoverageCount: input.fullCaseFile.coverage.rawAnalysisInteractionCount,
    },
  });
};

const runExportStage = async (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
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
  const exportArtifacts = await exportDeepResearchArtifacts({
    dataDir: context.dataDir,
    store: context.store,
    jobId: context.jobId,
    finalPackage,
    fullCaseFile,
    finalReport,
  });
  logDeepResearchExportCompleted({
    logger: context.runtimeLogger,
    traceContext: context.traceContext,
    phase: "EXPORT_REPORT",
    exportDir: exportArtifacts.exportDir,
    finalReportHash: exportArtifacts.finalReportMarkdown.fileHash,
    fullCaseFileJsonHash: exportArtifacts.fullCaseFileJson.fileHash,
    fullCaseFileMarkdownHash: exportArtifacts.fullCaseFileMarkdown.fileHash,
    decisionPackageHash: exportArtifacts.decisionPackage.fileHash,
    evidenceIndexHash: exportArtifacts.evidenceIndex.fileHash,
  });
  exportStage.complete({
    durationMs: Math.max(0, Date.now() - exportStage.startedAt),
    refs: { exportDir: exportArtifacts.exportDir },
    hashes: {
      finalReportHash: exportArtifacts.finalReportMarkdown.fileHash,
      fullCaseFileJsonHash: exportArtifacts.fullCaseFileJson.fileHash,
      fullCaseFileMarkdownHash: exportArtifacts.fullCaseFileMarkdown.fileHash,
      decisionPackageHash: exportArtifacts.decisionPackage.fileHash,
      evidenceIndexHash: exportArtifacts.evidenceIndex.fileHash,
    },
  });
  return exportArtifacts;
};

const buildMergedRecordHashes = (input: {
  context: AnalysisExecutionContext;
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  exportArtifacts: Awaited<ReturnType<typeof exportDeepResearchArtifacts>>;
  finalReportRecord: ReturnType<AnalysisExecutionContext["store"]["getLatestFinalReport"]>;
}) => ({
  ...input.finalPackage.recordHashes,
  ...input.context.recordHashes,
  exportFinalReportHash: input.exportArtifacts.finalReportMarkdown.fileHash,
  exportFullCaseFileJsonHash: input.exportArtifacts.fullCaseFileJson.fileHash,
  exportFullCaseFileMarkdownHash: input.exportArtifacts.fullCaseFileMarkdown.fileHash,
  exportDecisionPackageHash: input.exportArtifacts.decisionPackage.fileHash,
  exportBusinessHtmlReportHash: input.exportArtifacts.businessHtmlReport.fileHash,
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

export const buildFullCaseFileStage = (
  context: AnalysisExecutionContext,
): FinalPackageSuccess | AnalysisFailure => {
  context.store.updateJobState({
    jobId: context.jobId,
    status: "running",
    phase: "FULL_CASE_FILE_BUILD",
  });
  const finalPackageStage = context.stageLogger.start({
    ...buildFlowStageStartFields({
    traceContext: context.traceContext,
    preview: { jobId: context.jobId },
    }),
    stageName: "FULL_CASE_FILE_BUILD",
  });
  let finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  let fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  try {
    finalPackage = buildDeepResearchStructuredIndex({
      store: context.store,
      jobId: context.jobId,
    });
    fullCaseFile = buildDeepResearchFullCaseFile({
      store: context.store,
      jobId: context.jobId,
      structuredIndex: finalPackage,
    });
  } catch (error) {
    return failFinalPackageStage(
      context,
      finalPackageStage,
      error instanceof Error ? error.message : "deep_research_full_case_file_build_failed",
    );
  }
  completeFinalPackageStage({
    context,
    finalPackageStage,
    finalPackage,
    fullCaseFile,
  });
  return {
    ok: true,
    finalPackage,
    fullCaseFile,
    fullCaseFileMarkdown: renderDeepResearchFullCaseFileMarkdown(fullCaseFile),
  };
};

export const runFinalReportPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
  fullCaseFileMarkdown: string,
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
    prompt: finalAdjudicationShellPrompt,
    promptKey: "final-adjudication",
    renderedPromptText: renderDeepResearchFinalAdjudicationPrompt({
      language: context.input.language,
      structuredIndex: finalPackage,
      fullCaseFile,
      fullCaseFileMarkdown,
      finalAdjudicationPromptBundle: fullCaseFile.researchPlan.finalAdjudicationPromptBundle,
    }),
    inputRefs: [`job:${context.jobId}:structured-index`, `job:${context.jobId}:full-case-file`],
    timeoutMs: 1_200_000,
    maxInputChars: Number.MAX_SAFE_INTEGER,
    stages: {
      send: "FINAL_ADJUDICATION_SEND",
      capture: "FINAL_ADJUDICATION_CAPTURE",
      parse: "FINAL_ADJUDICATION_PARSE",
      persist: "FINAL_ADJUDICATION_PERSIST",
    },
    parse: (rawText) => parseDeepResearchFinalAdjudicationResponse(rawText),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) => {
      const reportWithSourceNotes = mergeDeepResearchFinalReportSourceNotes({
        finalReport: parsed,
        packageSourceNotes: finalPackage.sourceNotes,
      });
      const finalReportRecord = context.store.saveFinalReport({
        jobId: context.jobId,
        interactionId: interaction.id,
        report: reportWithSourceNotes,
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
  return {
    ok: true,
    finalReport: mergeDeepResearchFinalReportSourceNotes({
      finalReport: finalReport.parsed,
      packageSourceNotes: finalPackage.sourceNotes,
    }),
  };
};

export const completeSuccessfulRun = async (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
  finalReport: DeepResearchFinalReport,
): Promise<DeepResearchResult> => {
  const exportArtifacts = await runExportStage(context, finalPackage, fullCaseFile, finalReport);
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
