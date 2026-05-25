import { RuntimeFailureClass } from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import { exportDeepResearchArtifacts } from "./deep-research-analysis.export.js";
import { buildDeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import { renderDeepResearchFullCaseFileMarkdown } from "./deep-research-analysis.full-case-file-render.js";
import { buildDeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";
import {
  logDeepResearchExportCompleted,
  logDeepResearchStructuredIndexBuilt,
  logDeepResearchJobCompleted,
} from "./deep-research-analysis.logging.js";
import { parseDeepResearchFinalAdjudicationResponse } from "./deep-research-analysis.parser.js";
import {
  buildFinalAdjudicationShellPrompt,
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
  fullCaseFileMarkdown: string;
}) => {
  const finalPackageHash = stableJsonHash(input.finalPackage);
  const fullCaseFileHash = stableJsonHash(input.fullCaseFile);
  const fullCaseFileMarkdownHash = stableJsonHash(input.fullCaseFileMarkdown);
  input.context.recordHashes.structuredIndexHash = finalPackageHash;
  input.context.recordHashes.fullCaseFileHash = fullCaseFileHash;
  input.context.recordHashes.fullCaseFileMarkdownHash = fullCaseFileMarkdownHash;
  logDeepResearchStructuredIndexBuilt({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "FULL_CASE_FILE_BUILD",
    packageHash: finalPackageHash,
    recordHashCount: Object.keys(input.context.recordHashes).length,
    promptVersionCount: Object.keys(input.finalPackage.promptVersions).length,
  });
  input.finalPackageStage.complete({
    durationMs: Math.max(0, Date.now() - input.finalPackageStage.startedAt),
    hashes: {
      finalPackageHash,
      fullCaseFileHash,
      fullCaseFileMarkdownHash,
    },
  });
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
      refs: { jobId: context.jobId },
    }),
    stageName: "FULL_CASE_FILE_BUILD",
  });
  try {
    const finalPackage = buildDeepResearchStructuredIndex({
      store: context.store,
      jobId: context.jobId,
    });
    const fullCaseFile = buildDeepResearchFullCaseFile({
      store: context.store,
      jobId: context.jobId,
      structuredIndex: finalPackage,
    });
    const fullCaseFileMarkdown = renderDeepResearchFullCaseFileMarkdown(fullCaseFile);
    completeFinalPackageStage({
      context,
      finalPackageStage,
      finalPackage,
      fullCaseFile,
      fullCaseFileMarkdown,
    });
    return {
      ok: true,
      finalPackage,
      fullCaseFile,
      fullCaseFileMarkdown,
    };
  } catch (error) {
    const reason = error instanceof Error
      ? error.message
      : "deep_research_full_case_file_build_failed";
    return failFinalPackageStage(context, finalPackageStage, reason);
  }
};

const buildMergedFinalReport = (input: {
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  finalReport: DeepResearchFinalReport;
}): DeepResearchFinalReport =>
  mergeDeepResearchFinalReportSourceNotes({
    finalReport: input.finalReport,
    packageSourceNotes: input.finalPackage.sourceNotes,
  });

export const runFinalReportPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
  fullCaseFileMarkdown: string,
): Promise<FinalReportSuccess | AnalysisFailure> => {
  const result = await runPromptExchange<DeepResearchFinalReport>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: buildFinalAdjudicationShellPrompt(),
    promptKey: "final-adjudication",
    renderedPromptText: renderDeepResearchFinalAdjudicationPrompt({
      language: context.input.language,
      structuredIndex: finalPackage,
      fullCaseFile,
      fullCaseFileMarkdown,
      finalAdjudicationPromptBundle: fullCaseFile.researchPlan.finalAdjudicationPromptBundle,
    }),
    inputRefs: [
      `job:${context.jobId}:structured-index`,
      `job:${context.jobId}:full-case-file`,
      `job:${context.jobId}:full-case-file-markdown`,
    ],
    timeoutMs: 1800000,
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
      const finalReport = buildMergedFinalReport({
        finalPackage,
        finalReport: parsed,
      });
      const finalReportRecord = context.store.saveFinalReport({
        jobId: context.jobId,
        interactionId: interaction.id,
        report: finalReport,
      });
      context.recordHashes.finalReportHash = finalReportRecord.reportHash;
      return {
        recordType: "final-report",
        recordId: finalReportRecord.id,
        count: 1,
      };
    },
  });
  if (result.status !== "parsed") {
    return finishPromptFailure(context, result);
  }
  return {
    ok: true,
    finalReport: buildMergedFinalReport({
      finalPackage,
      finalReport: result.parsed,
    }),
  };
};

const buildSuccessResult = (input: {
  context: AnalysisExecutionContext;
  finalReport: DeepResearchFinalReport;
}): DeepResearchResult => ({
  jobId: input.context.jobId,
  status: "success",
  jobStatus: "completed",
  phase: "COMPLETE",
  report: input.finalReport,
  recordHashes: input.context.recordHashes,
  failureReason: null,
  reviewReason: null,
});

const recordExportHashes = (
  context: AnalysisExecutionContext,
  exports: Awaited<ReturnType<typeof exportDeepResearchArtifacts>>,
): void => {
  context.recordHashes.finalReportMarkdownHash = exports.finalReportMarkdown.fileHash;
  context.recordHashes.fullCaseFileJsonHash = exports.fullCaseFileJson.fileHash;
  context.recordHashes.fullCaseFileMarkdownExportHash = exports.fullCaseFileMarkdown.fileHash;
  context.recordHashes.structuredIndexExportHash = exports.structuredIndex.fileHash;
  context.recordHashes.evidenceIndexHash = exports.evidenceIndex.fileHash;
  context.recordHashes.businessHtmlReportHash = exports.businessHtmlReport.fileHash;
};

const runExportStage = async (input: {
  context: AnalysisExecutionContext;
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  finalReport: DeepResearchFinalReport;
}): Promise<Awaited<ReturnType<typeof exportDeepResearchArtifacts>>> => {
  input.context.store.updateJobState({
    jobId: input.context.jobId,
    status: "running",
    phase: "EXPORT_REPORT",
  });
  const exportStage = input.context.stageLogger.start({
    ...buildFlowStageStartFields({
      traceContext: input.context.traceContext,
      refs: { jobId: input.context.jobId },
    }),
    stageName: "EXPORT_REPORT",
  });
  try {
    const exports = await exportDeepResearchArtifacts({
      dataDir: input.context.dataDir,
      store: input.context.store,
      jobId: input.context.jobId,
      structuredIndex: input.finalPackage,
      fullCaseFile: input.fullCaseFile,
      finalReport: input.finalReport,
    });
    recordExportHashes(input.context, exports);
    exportStage.complete({
      durationMs: Math.max(0, Date.now() - exportStage.startedAt),
      hashes: {
        finalReportHash: exports.finalReportMarkdown.fileHash,
        structuredIndexHash: exports.structuredIndex.fileHash,
        evidenceIndexHash: exports.evidenceIndex.fileHash,
      },
    });
    return exports;
  } catch (error) {
    const reason = error instanceof Error
      ? error.message
      : "deep_research_completion_failed";
    exportStage.fail({
      reason,
      failureClass: RuntimeFailureClass.INTERNAL_BUG,
      retryable: false,
      terminal: true,
      recoveryPolicy: "terminal",
      durationMs: Math.max(0, Date.now() - exportStage.startedAt),
    });
    throw error;
  }
};

const finalizeSuccessfulCompletion = (input: {
  context: AnalysisExecutionContext;
  exports: Awaited<ReturnType<typeof exportDeepResearchArtifacts>>;
  finalReport: DeepResearchFinalReport;
}): string => {
  logDeepResearchExportCompleted({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "COMPLETE",
    exportDir: input.exports.exportDir,
    finalReportHash: input.exports.finalReportMarkdown.fileHash,
    fullCaseFileJsonHash: input.exports.fullCaseFileJson.fileHash,
    fullCaseFileMarkdownHash: input.exports.fullCaseFileMarkdown.fileHash,
    structuredIndexHash: input.exports.structuredIndex.fileHash,
    evidenceIndexHash: input.exports.evidenceIndex.fileHash,
  });
  input.context.store.updateJobState({
    jobId: input.context.jobId,
    status: "completed",
    phase: "COMPLETE",
  });
  const reportHash = stableJsonHash(input.finalReport);
  logDeepResearchJobCompleted({
    logger: input.context.runtimeLogger,
    traceContext: input.context.traceContext,
    phase: "COMPLETE",
    reportHash,
    recordHashCount: Object.keys(input.context.recordHashes).length,
  });
  return reportHash;
};

const buildCompletionFailureResult = (input: {
  context: AnalysisExecutionContext;
  reason: string;
}): DeepResearchResult => finishFailure({
  store: input.context.store,
  runtimeLogger: input.context.runtimeLogger,
  traceContext: input.context.traceContext,
  jobId: input.context.jobId,
  status: "failed",
  phase: "COMPLETE",
  reason: input.reason,
  failureClass: RuntimeFailureClass.INTERNAL_BUG,
  recordHashes: input.context.recordHashes,
});

export const completeSuccessfulRun = async (
  context: AnalysisExecutionContext,
  finalPackage: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
  finalReport: DeepResearchFinalReport,
): Promise<DeepResearchResult> => {
  const completeStage = context.stageLogger.start({
    ...buildFlowStageStartFields({
      traceContext: context.traceContext,
      refs: { jobId: context.jobId },
    }),
    stageName: "COMPLETE",
  });
  try {
    const exports = await runExportStage({
      context,
      finalPackage,
      fullCaseFile,
      finalReport,
    });
    const reportHash = finalizeSuccessfulCompletion({
      context,
      exports,
      finalReport,
    });
    completeStage.complete({
      durationMs: Math.max(0, Date.now() - completeStage.startedAt),
      hashes: {
        reportHash,
        structuredIndexHash: exports.structuredIndex.fileHash,
      },
    });
    return buildSuccessResult({ context, finalReport });
  } catch (error) {
    const reason = error instanceof Error
      ? error.message
      : "deep_research_completion_failed";
    completeStage.fail({
      reason,
      failureClass: RuntimeFailureClass.INTERNAL_BUG,
      retryable: false,
      terminal: true,
      recoveryPolicy: "terminal",
      durationMs: Math.max(0, Date.now() - completeStage.startedAt),
    });
    return buildCompletionFailureResult({
      context,
      reason,
    });
  }
};
