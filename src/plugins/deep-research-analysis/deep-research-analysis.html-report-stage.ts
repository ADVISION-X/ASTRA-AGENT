import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
    type AnalysisExecutionContext,
    type AnalysisFailure,
    finishPromptFailure,
} from "./deep-research-analysis.analysis-runner.js";
import {
    buildDeepResearchGatewayInputRefs,
    getDeepResearchInputAttachmentLimits,
} from "./deep-research-analysis.input-attachments.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import {
    buildFailure,
    buildParsedResult,
    type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.parser.js";
import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import {
    buildBusinessHtmlReportShellPrompt,
    DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID,
    DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION,
    renderDeepResearchBusinessHtmlReportPrompt,
} from "./deep-research-analysis.prompts.js";
import type {
  DeepResearchRecordStore,
} from "./deep-research-analysis.records.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND =
  "business-report.html" as const;

export const DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE = "text/html" as const;

export type DeepResearchBusinessHtmlSourceKind = "html_artifact";

export type DeepResearchBusinessHtmlReportRecord = {
  artifactName: string;
  artifactMimeType: typeof DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE;
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  generatedAt: string;
  status: "business_html_report_generated";
  exportKind: typeof DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND;
  sourceKind: DeepResearchBusinessHtmlSourceKind;
};

const buildHtmlTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const CHATGPT_SHELL_HTML_MARKERS = ['property="og:title" content="chatgpt"', "window.__reactroutercontext", "/cdn/assets/", "data-message-author-role", "prompt-textarea", "composer-submit-button", "chatgpt 是一款", "历史聊天记录"];

export const DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS = [
  "summary-answer",
  "forensics-process",
  "business-conclusion",
  "n-stage-questions-and-answers",
] as const;

const isHtmlAttributeWhitespace = (value: string): boolean =>
  value === " " || value === "\n" || value === "\r" || value === "\t" || value === "\f";

const isHtmlAttributeNameBoundary = (value: string): boolean =>
  value === "" || value === "<" || value === "/" || isHtmlAttributeWhitespace(value);

const findHtmlSectionIdIndex = (htmlDocument: string, sectionId: string): number => {
  const lower = htmlDocument.toLowerCase();
  const quotedForms = [`"${sectionId}"`, `'${sectionId}'`];
  let searchFrom = 0;
  while (searchFrom < lower.length) {
    const idIndex = lower.indexOf("id", searchFrom);
    if (idIndex < 0) {
      return -1;
    }
    if (!isHtmlAttributeNameBoundary(lower[idIndex - 1] ?? "")) {
      searchFrom = idIndex + 2;
      continue;
    }
    let cursor = idIndex + 2;
    while (cursor < lower.length && isHtmlAttributeWhitespace(lower[cursor] ?? "")) {
      cursor += 1;
    }
    if (lower[cursor] !== "=") {
      searchFrom = idIndex + 2;
      continue;
    }
    cursor += 1;
    while (cursor < lower.length && isHtmlAttributeWhitespace(lower[cursor] ?? "")) {
      cursor += 1;
    }
    for (const quotedForm of quotedForms) {
      if (lower.startsWith(quotedForm, cursor)) {
        return idIndex;
      }
    }
    searchFrom = idIndex + 2;
  }
  return -1;
};

const hasRequiredBusinessHtmlReviewSections = (htmlDocument: string): boolean => {
  let previousIndex = -1;
  for (const sectionId of DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS) {
    const currentIndex = findHtmlSectionIdIndex(htmlDocument, sectionId);
    if (currentIndex <= previousIndex) {
      return false;
    }
    previousIndex = currentIndex;
  }
  return true;
};

const isBusinessHtmlArtifactText = (value: string): boolean => {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const isChatGptShellHtmlDocument = CHATGPT_SHELL_HTML_MARKERS.some((marker) => lower.includes(marker));
  return trimmed.length > 0
    && (lower.includes("<!doctype html") || lower.includes("<html"))
    && lower.includes("<body")
    && (lower.includes("</html>") || lower.includes("</body>"))
    && hasRequiredBusinessHtmlReviewSections(trimmed)
    && !isChatGptShellHtmlDocument;
};

const persistBusinessHtmlArtifact = (input: {
  htmlDocument: string;
  outputPath: string;
}): DeepResearchBusinessHtmlReportRecord => {
  mkdirSync(path.dirname(input.outputPath), { recursive: true });
  writeFileSync(input.outputPath, input.htmlDocument, "utf8");
  const bytes = Buffer.from(input.htmlDocument, "utf8");
  return {
    artifactName: path.basename(input.outputPath),
    artifactMimeType: DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE,
    filePath: input.outputPath,
    fileHash: buildHtmlTextHash(input.htmlDocument),
    fileSizeBytes: bytes.byteLength,
    generatedAt: new Date().toISOString(),
    status: "business_html_report_generated",
    exportKind: DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND,
    sourceKind: "html_artifact",
  };
};

export const buildBusinessHtmlReportOutputPath = (
  dataDir: string,
  jobId: string,
): string => path.join(
  dataDir,
  "deep-research-analysis",
  "exports",
  jobId,
  "business-report.html",
);

export const parseAndPersistBusinessHtmlReport = (input: {
  rawText: string;
  outputPath: string;
}): DeepResearchParserResult<DeepResearchBusinessHtmlReportRecord> => {
  const normalizedText = input.rawText.trim();
  const rawResponseHash = buildHtmlTextHash(normalizedText);
  if (!isBusinessHtmlArtifactText(normalizedText)) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      "business_html_document_missing",
      "partial_review_required",
    );
  }
  try {
    return buildParsedResult({
      parsed: persistBusinessHtmlArtifact({
        htmlDocument: normalizedText,
        outputPath: input.outputPath,
      }),
      normalizedText,
      rawResponseHash,
    });
  } catch (error) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      error instanceof Error ? error.message : "business_html_persist_failed",
      "partial_review_required",
    );
  }
};

type HtmlReportSuccess = {
  ok: true;
  htmlReport: DeepResearchBusinessHtmlReportRecord;
};

const buildBusinessHtmlPromptText = (input: {
  context: AnalysisExecutionContext;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
}): string => renderDeepResearchBusinessHtmlReportPrompt({
  finalAdjudication: input.finalAdjudication,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  htmlReportPromptBundle: input.fullCaseFile.researchPlan.htmlReportPromptBundle,
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
      promptId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID,
      promptVersion: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION,
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
  finalPackage: DeepResearchStructuredIndex,
  finalAdjudication: DeepResearchFinalAdjudicationRecord,
  fullCaseFile: DeepResearchFullCaseFile,
  fullCaseFileMarkdown: string,
): Promise<HtmlReportSuccess | AnalysisFailure> => {
  const outputPath = buildBusinessHtmlReportOutputPath(context.dataDir, context.jobId);
  const attachmentLimits = getDeepResearchInputAttachmentLimits(context.input.inputAttachments);
  const result = await runPromptExchange<DeepResearchBusinessHtmlReportRecord>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: buildBusinessHtmlReportShellPrompt(),
    promptKey: "business-html-report",
    renderedPromptText: buildBusinessHtmlPromptText({
      context,
      finalAdjudication,
      fullCaseFile,
      fullCaseFileMarkdown,
    }),
    inputRefs: buildDeepResearchGatewayInputRefs({
      baseRefs: [
        `job:${context.jobId}:structured-index`,
        `job:${context.jobId}:final-adjudication-raw`,
        `job:${context.jobId}:full-case-file`,
      ],
      attachments: context.input.inputAttachments,
    }),
    timeoutMs: 1_800_000,
    maxInputChars: Number.MAX_SAFE_INTEGER,
    maxFileCount: attachmentLimits.maxFileCount,
    maxFileBytes: attachmentLimits.maxFileBytes,
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
