export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND =
  "business-report.html" as const;

export const DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE = "text/html" as const;

export type DeepResearchBusinessHtmlReportStatus =
  | "business_html_report_generated"
  | "business_html_artifact_missing"
  | "business_html_invalid_file"
  | "business_html_persist_failed";

export type DeepResearchBusinessHtmlSourceKind =
  | "html_artifact"
  | "raw_html_text";

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

export const isBusinessHtmlDocument = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (!/(?:<!DOCTYPE html\b|<html\b)/iu.test(trimmed)) {
    return false;
  }
  return /<body\b/iu.test(trimmed);
};