import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

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

const isBusinessHtmlArtifactText = (value: string): boolean => {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return trimmed.length > 0
    && (lower.includes("<!doctype html") || lower.includes("<html"))
    && lower.includes("<body")
    && (lower.includes("</html>") || lower.includes("</body>"));
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
    fileHash: buildTextHash(input.htmlDocument),
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
  const rawResponseHash = buildTextHash(normalizedText);
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
