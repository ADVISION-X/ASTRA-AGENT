import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import type { DeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import {
  businessHtmlReportPublisherPrompt,
  renderDeepResearchBusinessHtmlReportPrompt,
} from "./deep-research-analysis.html-report-prompt.js";
import {
  buildBusinessHtmlReportOutputPath,
  parseAndPersistBusinessHtmlReport,
} from "./deep-research-analysis.html-report-export.js";
import type { DeepResearchBusinessHtmlReportRecord } from "./deep-research-analysis.html-report-records.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import {
  buildDeepResearchSourceNotesFromReferences,
} from "./deep-research-analysis.source-notes.js";
import {
  type AnalysisExecutionContext,
  type AnalysisFailure,
  finishPromptFailure,
} from "./deep-research-analysis.analysis-support.js";

const buildHtmlSourceNotes = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): unknown[] => {
  if (input.finalReport.sourceNotes.length > 0) {
    return input.finalReport.sourceNotes;
  }
  if (input.finalPackage.sourceNotes.length > 0) {
    return input.finalPackage.sourceNotes;
  }
  const references = Array.isArray(input.finalReport.references) ? input.finalReport.references : [];
  if (references.length > 0) {
    return buildDeepResearchSourceNotesFromReferences(references);
  }
  return input.finalPackage.analysisRecords.flatMap((record) => {
    const evidenceMentions = record.evidenceMentions;
    return buildDeepResearchSourceNotesFromReferences(evidenceMentions);
  });
};

type HtmlReportSuccess = {
  ok: true;
  htmlReport: DeepResearchBusinessHtmlReportRecord;
};

const buildBusinessHtmlPromptText = (input: {
  context: AnalysisExecutionContext;
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): string => renderDeepResearchBusinessHtmlReportPrompt({
  finalPackage: input.finalPackage,
  finalReport: input.finalReport,
  sourceNotes: buildHtmlSourceNotes({
    finalPackage: input.finalPackage,
    finalReport: input.finalReport,
  }),
  language: input.context.input.language,
});

const persistBusinessHtmlReport = (input: {
  context: AnalysisExecutionContext;
  interaction: { rawResponseText: string };
  parsed: DeepResearchBusinessHtmlReportRecord;
}) => {
  const exportRecord = input.context.store.saveExport({
    jobId: input.context.jobId,
    exportKind: input.parsed.exportKind,
    filePath: input.parsed.filePath,
    fileHash: input.parsed.fileHash,
    payload: {
      jobId: input.context.jobId,
      phaseId: "HTML_REPORT_PERSIST",
      promptId: businessHtmlReportPublisherPrompt.promptId,
      promptVersion: businessHtmlReportPublisherPrompt.promptVersion,
      rawAssistantText: input.interaction.rawResponseText,
      artifactName: input.parsed.artifactName,
      artifactMimeType: input.parsed.artifactMimeType,
      filePath: input.parsed.filePath,
      fileHash: input.parsed.fileHash,
      fileSizeBytes: input.parsed.fileSizeBytes,
      generatedAt: input.parsed.generatedAt,
      exportKind: input.parsed.exportKind,
      status: input.parsed.status,
      sourceKind: input.parsed.sourceKind,
    },
  });
  input.context.recordHashes.businessHtmlReportHash = input.parsed.fileHash;
  input.context.recordHashes.businessHtmlReportExportHash = exportRecord.fileHash;
  return {
    recordType: "business-report.html",
    recordId: exportRecord.id,
    count: 1,
  };
};

export const runBusinessHtmlReportPhase = async (
  context: AnalysisExecutionContext,
  finalPackage: DeepResearchFinalPackage,
  finalReport: DeepResearchFinalReport,
): Promise<HtmlReportSuccess | AnalysisFailure> => {
  const outputPath = buildBusinessHtmlReportOutputPath(context.dataDir, context.jobId);
  const result = await runPromptExchange<DeepResearchBusinessHtmlReportRecord>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: businessHtmlReportPublisherPrompt,
    promptKey: "business-html-report",
    renderedPromptText: buildBusinessHtmlPromptText({
      context,
      finalPackage,
      finalReport,
    }),
    inputRefs: [
      `job:${context.jobId}:final-package`,
      `job:${context.jobId}:final-report`,
    ],
    timeoutMs: 1_800_000,
    maxInputChars: Number.MAX_SAFE_INTEGER,
    stages: {
      send: "HTML_REPORT_SEND",
      capture: "HTML_REPORT_CAPTURE",
      parse: "HTML_REPORT_DETECT",
      persist: "HTML_REPORT_PERSIST",
    },
    parse: (rawText: string) => parseAndPersistBusinessHtmlReport({
      rawText,
      outputPath,
    }),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }: {
      interaction: { rawResponseText: string };
      parsed: DeepResearchBusinessHtmlReportRecord;
    }) => persistBusinessHtmlReport({
      context,
      interaction,
      parsed,
    }),
  });
  if (result.status !== "parsed") {
    return finishPromptFailure(context, result);
  }
  return {
    ok: true,
    htmlReport: result.parsed,
  };
};
