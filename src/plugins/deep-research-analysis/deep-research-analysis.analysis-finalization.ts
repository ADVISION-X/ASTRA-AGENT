import { RuntimeFailureClass } from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import { buildDeepResearchConflictMatrix } from "./deep-research-analysis.conflict-matrix.js";
import { exportDeepResearchArtifacts } from "./deep-research-analysis.export.js";
import { buildDeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import {
  logDeepResearchExportCompleted,
  logDeepResearchFinalPackageBuilt,
  logDeepResearchJobCompleted,
  logDeepResearchRecordPersisted,
} from "./deep-research-analysis.logging.js";
import { parseDeepResearchFinalReportResponse } from "./deep-research-analysis.parser.js";
import { finalSynthesisPrompt, renderDeepResearchFinalSynthesisPrompt } from "./deep-research-analysis.prompts.js";
import { type DeepResearchFinalReport, type DeepResearchResult } from "./deep-research-analysis.result.js";
import { finishFailure, startFlowStage } from "./deep-research-analysis.flow-shared.js";
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

const failFinalPackageStage = (
  context: AnalysisExecutionContext,
  finalPackageStage: ReturnType<typeof startFlowStage>,
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

const logConflictMatrixRows = (
  context: AnalysisExecutionContext,
  rowCount: number,
  firstRowId: string | null,
) => {
  if (rowCount === 0) {
    return;
  }
  logDeepResearchRecordPersisted({
    logger: context.runtimeLogger,
    traceContext: context.traceContext,
    phase: "FINAL_PACKAGE_BUILD",
    recordType: "conflict-matrix",
    recordId: firstRowId ?? context.jobId,
    count: rowCount,
  });
};

const completeFinalPackageStage = (input: {
  context: AnalysisExecutionContext;
  finalPackageStage: ReturnType<typeof startFlowStage>;
  finalPackage: ReturnType<typeof buildDeepResearchFinalPackage>;
  conflictRowCount: number;
}) => {
  const finalPackageHash = stableJsonHash(input.finalPackage);
  logDeepResearchFinalPackageBuilt({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "FINAL_PACKAGE_BUILD",
    packageHash: finalPackageHash,
    recordHashCount: Object.keys(input.finalPackage.recordHashes).length,
    promptVersionCount: Object.keys(input.finalPackage.promptVersions).length,
  });
  input.finalPackageStage.complete({
    hashes: { packageHash: finalPackageHash },
    metrics: {
      conflictRowCount: input.conflictRowCount,
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
  const exportStage = startFlowStage({
    stageLogger: context.stageLogger,
    traceContext: context.traceContext,
    stageName: "EXPORT_REPORT",
    preview: { jobId: context.jobId },
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
  const finalPackageStage = startFlowStage({
    stageLogger: context.stageLogger,
    traceContext: context.traceContext,
    stageName: "FINAL_PACKAGE_BUILD",
    preview: { jobId: context.jobId },
  });
  const conflictMatrixResult = buildDeepResearchConflictMatrix({
    store: context.store,
    jobId: context.jobId,
  });
  if (conflictMatrixResult.status !== "completed") {
    return failFinalPackageStage(
      context,
      finalPackageStage,
      conflictMatrixResult.reason,
    );
  }
  const firstRow = conflictMatrixResult.rows[0];
  logConflictMatrixRows(
    context,
    conflictMatrixResult.rows.length,
    firstRow ? firstRow.id : null,
  );
  const finalPackage = buildDeepResearchFinalPackage({
    store: context.store,
    jobId: context.jobId,
  });
  completeFinalPackageStage({
    context,
    finalPackageStage,
    finalPackage,
    conflictRowCount: conflictMatrixResult.rows.length,
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
    prompt: finalSynthesisPrompt,
    promptKey: "final-synthesis",
    renderedPromptText: renderDeepResearchFinalSynthesisPrompt({
      userQuestion: context.input.userQuestion,
      analysisGoal: context.input.analysisGoal,
      language: context.input.language,
      finalPackage,
    }),
    inputRefs: [`job:${context.jobId}:final-package`],
    maxInputChars: 45_000,
    stages: {
      send: "FINAL_SEND",
      capture: "FINAL_CAPTURE",
      parse: "FINAL_PARSE",
      persist: "FINAL_PERSIST",
    },
    parse: parseDeepResearchFinalReportResponse,
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