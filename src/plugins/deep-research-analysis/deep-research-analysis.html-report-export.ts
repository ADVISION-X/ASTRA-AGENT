import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  detectHtmlArtifactInWebChatResponse,
  downloadWebChatHtmlArtifact,
  extractRawHtmlDocumentFromWebChatResponse,
  type WebChatHtmlDownloadSuccess,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  buildFailure,
  buildParsedResult,
  type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
import {
  DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE,
  DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND,
  isBusinessHtmlDocument,
  type DeepResearchBusinessHtmlReportRecord,
} from "./deep-research-analysis.html-report-records.js";

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildBinaryHash = (value: Uint8Array): string =>
  "sha256:" + createHash("sha256").update(value).digest("hex");

const toGeneratedRecord = (input: WebChatHtmlDownloadSuccess): DeepResearchBusinessHtmlReportRecord => ({
  artifactName: input.artifactName,
  artifactMimeType: DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE,
  filePath: input.filePath,
  fileHash: input.fileHash,
  fileSizeBytes: input.fileSizeBytes,
  generatedAt: input.downloadedAt,
  status: "business_html_report_generated",
  exportKind: DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND,
  sourceKind: "html_artifact",
});

const persistRawHtmlDocument = (input: {
  htmlDocument: string;
  outputPath: string;
}): DeepResearchBusinessHtmlReportRecord | null => {
  if (!isBusinessHtmlDocument(input.htmlDocument)) {
    return null;
  }
  mkdirSync(path.dirname(input.outputPath), { recursive: true });
  writeFileSync(input.outputPath, `${input.htmlDocument.trimEnd()}\n`, "utf8");
  const bytes = readFileSync(input.outputPath);
  const htmlText = readFileSync(input.outputPath, "utf8");
  const stat = statSync(input.outputPath);
  if (stat.size <= 0 || !isBusinessHtmlDocument(htmlText)) {
    return null;
  }
  return {
    artifactName: path.basename(input.outputPath),
    artifactMimeType: DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE,
    filePath: input.outputPath,
    fileHash: buildBinaryHash(bytes),
    fileSizeBytes: stat.size,
    generatedAt: new Date().toISOString(),
    status: "business_html_report_generated",
    exportKind: DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND,
    sourceKind: "raw_html_text",
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
  const rawResponseHash = buildTextHash(normalizedText);
  const htmlArtifact = detectHtmlArtifactInWebChatResponse(normalizedText);
  if (htmlArtifact) {
    const result = downloadWebChatHtmlArtifact({
      candidate: htmlArtifact,
      outputPath: input.outputPath,
    });
    if (!result.ok) {
      return buildFailure(
        normalizedText,
        rawResponseHash,
        result.status,
        "partial_review_required",
      );
    }
    return buildParsedResult({
      parsed: toGeneratedRecord(result),
      normalizedText,
      rawResponseHash,
    });
  }
  const htmlDocument = extractRawHtmlDocumentFromWebChatResponse(input.rawText);
  if (!htmlDocument) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      "business_html_artifact_missing",
      "partial_review_required",
    );
  }
  const persisted = persistRawHtmlDocument({
    htmlDocument,
    outputPath: input.outputPath,
  });
  if (!persisted) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      "business_html_invalid_file",
      "partial_review_required",
    );
  }
  return buildParsedResult({
    parseStatus: "parsed_text_fallback",
    parsed: persisted,
    normalizedText,
    rawResponseHash,
  });
};