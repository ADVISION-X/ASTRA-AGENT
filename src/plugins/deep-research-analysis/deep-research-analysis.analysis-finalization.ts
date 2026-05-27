import { RuntimeFailureClass } from "../../lib/runtime-logs/index.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
    buildFlowStageStartFields,
    finishFailure,
    finishPromptFailure,
    type AnalysisExecutionContext,
    type AnalysisFailure,
    type FlowStageHandle,
} from "./deep-research-analysis.analysis-runner.js";
import { buildDeepResearchFullCaseFile, renderDeepResearchFullCaseFileMarkdown } from "./deep-research-analysis.full-case-file.js";
import { exportDeepResearchArtifacts } from "./deep-research-analysis.export-artifacts.js";
import {
    logDeepResearchExportCompleted,
    logDeepResearchJobCompleted,
    logDeepResearchStructuredIndexBuilt,
} from "./deep-research-analysis.logging.js";
import type {
    DeepResearchFinalAdjudicationParse,
    DeepResearchFinalAdjudicationRecord,
    DeepResearchResult,
} from "./deep-research-analysis.parser.js";
import { parseDeepResearchFinalAdjudicationResponse } from "./deep-research-analysis.parser.js";
import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import {
    buildFinalAdjudicationShellPrompt,
    renderDeepResearchFinalAdjudicationPrompt,
} from "./deep-research-analysis.prompts.js";
import { buildDeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

type FullCaseFileSuccess = {
  ok: true;
  structuredIndex: ReturnType<typeof buildDeepResearchStructuredIndex>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  fullCaseFileMarkdown: string;
};

type FinalAdjudicationSuccess = {
  ok: true;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
};

const failFullCaseFileStage = (
  context: AnalysisExecutionContext,
  stage: FlowStageHandle,
  reason: string,
): AnalysisFailure => {
  stage.reviewRequired({
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

export const buildFullCaseFileStage = (
  context: AnalysisExecutionContext,
): FullCaseFileSuccess | AnalysisFailure => {
  context.store.updateJobState({
    jobId: context.jobId,
    status: "running",
    phase: "FULL_CASE_FILE_BUILD",
  });
  const stage = context.stageLogger.start({
    ...buildFlowStageStartFields({
      traceContext: context.traceContext,
      refs: { jobId: context.jobId },
    }),
    stageName: "FULL_CASE_FILE_BUILD",
  });
  try {
    const structuredIndex = buildDeepResearchStructuredIndex({
      store: context.store,
      jobId: context.jobId,
    });
    const fullCaseFile = buildDeepResearchFullCaseFile({
      store: context.store,
      jobId: context.jobId,
      structuredIndex,
    });
    const fullCaseFileMarkdown = renderDeepResearchFullCaseFileMarkdown(fullCaseFile);
    const structuredIndexHash = stableJsonHash(structuredIndex);
    context.recordHashes.structuredIndexHash = structuredIndexHash;
    context.recordHashes.fullCaseFileHash = stableJsonHash(fullCaseFile);
    logDeepResearchStructuredIndexBuilt({
      logger: context.runtimeLogger,
      traceContext: context.traceContext,
      phase: "FULL_CASE_FILE_BUILD",
      packageHash: structuredIndexHash,
      recordHashCount: Object.keys(context.recordHashes).length,
      promptVersionCount: Object.keys(structuredIndex.promptVersions).length,
    });
    stage.complete({
      durationMs: Math.max(0, Date.now() - stage.startedAt),
      hashes: { structuredIndexHash },
    });
    return {
      ok: true,
      structuredIndex,
      fullCaseFile,
      fullCaseFileMarkdown,
    };
  } catch (error) {
    return failFullCaseFileStage(
      context,
      stage,
      error instanceof Error ? error.message : "deep_research_full_case_file_build_failed",
    );
  }
};

export const runFinalAdjudicationPhase = async (
  context: AnalysisExecutionContext,
  structuredIndex: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
  fullCaseFileMarkdown: string,
): Promise<FinalAdjudicationSuccess | AnalysisFailure> => {
  const prompt = buildFinalAdjudicationShellPrompt();
  const result = await runPromptExchange<DeepResearchFinalAdjudicationParse>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt,
    promptKey: "final-adjudication",
    renderedPromptText: renderDeepResearchFinalAdjudicationPrompt({
      language: context.input.language,
      structuredIndex,
      fullCaseFile,
      fullCaseFileMarkdown,
      finalAdjudicationPromptBundle: fullCaseFile.researchPlan.finalAdjudicationPromptBundle,
    }),
    inputRefs: [
      `job:${context.jobId}:structured-index`,
      `job:${context.jobId}:full-case-file`,
      `job:${context.jobId}:full-case-file-markdown`,
    ],
    timeoutMs: 1_800_000,
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
      const record = context.store.saveFinalAdjudication({
        jobId: context.jobId,
        interactionId: interaction.id,
        promptId: prompt.promptId,
        promptVersion: prompt.promptVersion,
        parsed,
        promptBundleSnapshot: fullCaseFile.researchPlan.finalAdjudicationPromptBundle,
      });
      context.recordHashes.finalAdjudicationRawHash = record.rawResponseHash;
      return {
        recordType: "final-adjudication-raw",
        recordId: record.id,
        count: 1,
      };
    },
  });
  if (result.status !== "parsed") {
    return finishPromptFailure(context, result);
  }
  const finalAdjudication = context.store.getLatestFinalAdjudication(context.jobId);
  if (!finalAdjudication) {
    throw new Error("Deep Research final adjudication raw record is missing.");
  }
  return {
    ok: true,
    finalAdjudication,
  };
};

const runExportStage = async (input: {
  context: AnalysisExecutionContext;
  structuredIndex: ReturnType<typeof buildDeepResearchStructuredIndex>;
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
}): Promise<Awaited<ReturnType<typeof exportDeepResearchArtifacts>>> => {
  input.context.store.updateJobState({
    jobId: input.context.jobId,
    status: "running",
    phase: "EXPORT_REPORT",
  });
  const stage = input.context.stageLogger.start({
    ...buildFlowStageStartFields({
      traceContext: input.context.traceContext,
      refs: { jobId: input.context.jobId },
    }),
    stageName: "EXPORT_REPORT",
  });
  const exports = await exportDeepResearchArtifacts({
    dataDir: input.context.dataDir,
    store: input.context.store,
    jobId: input.context.jobId,
    structuredIndex: input.structuredIndex,
    fullCaseFile: input.fullCaseFile,
    finalAdjudication: input.finalAdjudication,
  });
  input.context.recordHashes.finalAdjudicationRawExportHash = exports.finalAdjudicationRaw.fileHash;
  input.context.recordHashes.fullCaseFileJsonHash = exports.fullCaseFileJson.fileHash;
  input.context.recordHashes.fullCaseFileMarkdownExportHash = exports.fullCaseFileMarkdown.fileHash;
  input.context.recordHashes.structuredIndexExportHash = exports.structuredIndex.fileHash;
  input.context.recordHashes.evidenceIndexHash = exports.evidenceIndex.fileHash;
  input.context.recordHashes.businessHtmlReportHash = exports.businessHtmlReport.fileHash;
  stage.complete({
    durationMs: Math.max(0, Date.now() - stage.startedAt),
    hashes: {
      finalAdjudicationRawExportHash: exports.finalAdjudicationRaw.fileHash,
      businessHtmlReportHash: exports.businessHtmlReport.fileHash,
    },
  });
  return exports;
};

export const completeSuccessfulRun = async (
  context: AnalysisExecutionContext,
  structuredIndex: ReturnType<typeof buildDeepResearchStructuredIndex>,
  fullCaseFile: ReturnType<typeof buildDeepResearchFullCaseFile>,
  finalAdjudication: DeepResearchFinalAdjudicationRecord,
): Promise<DeepResearchResult> => {
  const exports = await runExportStage({
    context,
    structuredIndex,
    fullCaseFile,
    finalAdjudication,
  });
  logDeepResearchExportCompleted({
    logger: context.runtimeLogger,
    traceContext: context.traceContext,
    phase: "EXPORT_REPORT",
    exportDir: exports.exportDir,
    finalAdjudicationHash: exports.finalAdjudicationRaw.fileHash,
    fullCaseFileJsonHash: exports.fullCaseFileJson.fileHash,
    fullCaseFileMarkdownHash: exports.fullCaseFileMarkdown.fileHash,
    structuredIndexHash: exports.structuredIndex.fileHash,
    evidenceIndexHash: exports.evidenceIndex.fileHash,
  });
  context.store.updateJobState({
    jobId: context.jobId,
    status: "completed",
    phase: "COMPLETE",
  });
  logDeepResearchJobCompleted({
    logger: context.runtimeLogger,
    traceContext: context.traceContext,
    phase: "COMPLETE",
    reportHash: finalAdjudication.rawResponseHash,
    recordHashCount: Object.keys(context.recordHashes).length,
  });
  return {
    jobId: context.jobId,
    status: "success",
    jobStatus: "completed",
    phase: "COMPLETE",
    finalAdjudication,
    recordHashes: context.recordHashes,
    failureReason: null,
    reviewReason: null,
  };
};
