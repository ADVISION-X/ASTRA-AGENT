import { createHash } from "node:crypto";
import path from "node:path";

import {
  detectHtmlArtifactInWebChatResponse,
  downloadWebChatHtmlArtifact,
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
  type DeepResearchBusinessHtmlReportRecord,
} from "./deep-research-analysis.html-report-records.js";

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

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
  return buildFailure(
    normalizedText,
    rawResponseHash,
    "business_html_artifact_missing",
    "partial_review_required",
  );
};
