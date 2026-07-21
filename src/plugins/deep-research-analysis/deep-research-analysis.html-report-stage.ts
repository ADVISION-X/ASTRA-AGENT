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
import {
  DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE,
  DEEP_RESEARCH_BUSINESS_HTML_N_STAGE_RETENTION_FLOOR,
  DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND,
  DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS,
  type DeepResearchBusinessHtmlReportRecord,
} from "./deep-research-analysis.html-report-contract.js";
export { DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND, DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS } from "./deep-research-analysis.html-report-contract.js";

const buildHtmlTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const CHATGPT_SHELL_HTML_MARKERS = ['property="og:title" content="chatgpt"', "window.__reactroutercontext", "/cdn/assets/", "data-message-author-role", "prompt-textarea", "composer-submit-button", "chatgpt 是一款", "历史聊天记录"];

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

const findHtmlSectionSource = (htmlDocument: string, sectionId: string): string => {
  const idIndex = findHtmlSectionIdIndex(htmlDocument, sectionId);
  if (idIndex < 0) {
    return "";
  }
  const lower = htmlDocument.toLowerCase();
  const sectionStart = lower.lastIndexOf("<section", idIndex);
  const start = sectionStart >= 0 ? sectionStart : idIndex;
  const nextSection = lower.indexOf("<section", idIndex + sectionId.length);
  const endMain = lower.indexOf("</main", idIndex + sectionId.length);
  const endBody = lower.indexOf("</body", idIndex + sectionId.length);
  const candidates = [nextSection, endMain, endBody].filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : htmlDocument.length;
  return htmlDocument.slice(start, end);
};

const findHtmlSectionClosingIndex = (htmlDocument: string, sectionId: string): number => {
  const idIndex = findHtmlSectionIdIndex(htmlDocument, sectionId);
  if (idIndex < 0) {
    return -1;
  }
  const lower = htmlDocument.toLowerCase();
  const sectionStart = lower.lastIndexOf("<section", idIndex);
  const searchFrom = sectionStart >= 0 ? sectionStart : idIndex;
  return lower.indexOf("</section", searchFrom);
};

const stripHtmlTagContent = (value: string, openTag: string, closeTag: string): string => {
  let output = value;
  let searchFrom = 0;
  const lowerOpenTag = openTag.toLowerCase();
  const lowerCloseTag = closeTag.toLowerCase();
  while (searchFrom < output.length) {
    const lower = output.toLowerCase();
    const start = lower.indexOf(lowerOpenTag, searchFrom);
    if (start < 0) break;
    const end = lower.indexOf(lowerCloseTag, start + lowerOpenTag.length);
    if (end < 0) {
      output = output.slice(0, start);
      break;
    }
    output = output.slice(0, start) + " " + output.slice(end + closeTag.length);
    searchFrom = start + 1;
  }
  return output;
};

const stripHtmlTags = (value: string): string => {
  let output = "";
  let insideTag = false;
  for (const character of value) {
    if (character === "<") {
      insideTag = true;
      output += " ";
      continue;
    }
    if (character === ">") {
      insideTag = false;
      output += " ";
      continue;
    }
    if (!insideTag) {
      output += character;
    }
  }
  return output;
};

const decodeMinimalHtmlEntities = (value: string): string =>
  value
    .split("&nbsp;").join(" ")
    .split("&#160;").join(" ")
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join("\"")
    .split("&#39;").join("'");

const escapeHtmlText = (value: string): string =>
  value
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split("\"").join("&quot;")
    .split("'").join("&#39;");

const normalizeVisibleText = (value: string): string =>
  decodeMinimalHtmlEntities(
    stripHtmlTags(
      stripHtmlTagContent(
        stripHtmlTagContent(value, "<script", "</script>"),
        "<style",
        "</style>",
      ),
    ),
  )
    .trim()
    .split(/\s+/u)
    .join(" ");

const readNStageSourceText = (entry: DeepResearchFullCaseFile["subQuestionAnalyses"][number]): string =>
  typeof (entry.structuredAnswer as { answerText?: unknown } | null)?.answerText === "string"
    ? (entry.structuredAnswer as { answerText: string }).answerText
    : (entry.promptInteraction?.rawResponseText ?? "");

const buildNStageRetentionStats = (fullCaseFile: DeepResearchFullCaseFile, nStageSectionSource: string): {
  htmlVisibleTextLength: number;
  ratio: number;
  sourceTextLength: number;
} => {
  const sourceTextLength = fullCaseFile.subQuestionAnalyses.reduce((total, entry) => total + normalizeVisibleText(readNStageSourceText(entry)).length, 0);
  const htmlVisibleTextLength = normalizeVisibleText(nStageSectionSource).length;
  return {
    htmlVisibleTextLength,
    ratio: sourceTextLength === 0 ? 1 : htmlVisibleTextLength / sourceTextLength,
    sourceTextLength,
  };
};

const readMissingNStageCitation = (fullCaseFile: DeepResearchFullCaseFile, nStageSectionSource: string): string | null => {
  const sectionText = normalizeVisibleText(nStageSectionSource);
  for (const entry of fullCaseFile.subQuestionAnalyses) {
    const responseHash = entry.promptInteraction?.rawResponseHash;
    const sourceText = readNStageSourceText(entry).trim();
    if (!sourceText) {
      continue;
    }
    if (!responseHash || !sectionText.includes(responseHash)) {
      return entry.subQuestionId;
    }
  }
  return null;
};

const readBusinessHtmlCaseFileFailure = (htmlDocument: string, fullCaseFile: DeepResearchFullCaseFile): string | null => {
  if (!htmlDocument.includes(fullCaseFile.job.jobId)) {
    return "business_html_case_file_job_id_missing";
  }
  const nStageSectionSource = findHtmlSectionSource(htmlDocument, "n-stage-questions-and-answers");
  const missingCitationSubQuestionId = readMissingNStageCitation(fullCaseFile, nStageSectionSource);
  if (missingCitationSubQuestionId) {
    return `business_html_n_stage_citation_missing:${missingCitationSubQuestionId}`;
  }
  const retention = buildNStageRetentionStats(fullCaseFile, nStageSectionSource);
  if (retention.ratio < DEEP_RESEARCH_BUSINESS_HTML_N_STAGE_RETENTION_FLOOR) {
    return `business_html_n_stage_retention_below_80:${retention.htmlVisibleTextLength}/${retention.sourceTextLength}`;
  }
  return null;
};

const buildCanonicalNStageRetentionAppendix = (fullCaseFile: DeepResearchFullCaseFile): string => {
  const blocks = fullCaseFile.subQuestionAnalyses.map((entry, index) => {
    const responseHash = entry.promptInteraction?.rawResponseHash ?? "raw_response_hash_missing";
    const sourceText = readNStageSourceText(entry);
    return [
      `<article class="canonical-n-stage-answer" data-sub-question-id="${escapeHtmlText(entry.subQuestionId)}">`,
      `<h3>完整 N 阶段证据 Q${index + 1}：${escapeHtmlText(entry.title ?? entry.modelQuestionId ?? entry.subQuestionId)}</h3>`,
      `<p><strong>问题文本：</strong>${escapeHtmlText(entry.questionText)}</p>`,
      `<p><strong>解析状态：</strong>${escapeHtmlText(entry.structuredAnswerStatus)}</p>`,
      `<p><strong>Raw Response Hash：</strong>${escapeHtmlText(responseHash)}</p>`,
      `<pre>${escapeHtmlText(sourceText)}</pre>`,
      "</article>",
    ].join("\n");
  }).join("\n");
  return [
    '<div class="canonical-n-stage-retention-appendix" data-generated-from="full-case-file">',
    "<h2>系统追加：完整 N 阶段证据附录</h2>",
    "<p>本附录由系统从 full case file 的持久化 N 阶段回答确定性追加，用于防止最终报告稀释 N 阶段材料；它不是模型二次总结。</p>",
    blocks,
    "</div>",
  ].join("\n");
};

const ensureCanonicalNStageRetentionAppendix = (
  htmlDocument: string,
  fullCaseFile: DeepResearchFullCaseFile,
): string => {
  if (htmlDocument.includes('class="canonical-n-stage-retention-appendix"')) {
    return htmlDocument;
  }
  const insertionIndex = findHtmlSectionClosingIndex(htmlDocument, "n-stage-questions-and-answers");
  if (insertionIndex < 0) {
    return htmlDocument;
  }
  const appendix = buildCanonicalNStageRetentionAppendix(fullCaseFile);
  return `${htmlDocument.slice(0, insertionIndex)}\n${appendix}\n${htmlDocument.slice(insertionIndex)}`;
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
  fullCaseFile: DeepResearchFullCaseFile;
  rawText: string;
  outputPath: string;
}): DeepResearchParserResult<DeepResearchBusinessHtmlReportRecord> => {
  const normalizedText = ensureCanonicalNStageRetentionAppendix(
    input.rawText.trim(),
    input.fullCaseFile,
  );
  const rawResponseHash = buildHtmlTextHash(normalizedText);
  if (!isBusinessHtmlArtifactText(normalizedText)) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      "business_html_document_missing",
      "partial_review_required",
    );
  }
  const caseFileFailure = readBusinessHtmlCaseFileFailure(normalizedText, input.fullCaseFile);
  if (caseFileFailure) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      caseFileFailure,
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
      fullCaseFile,
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
