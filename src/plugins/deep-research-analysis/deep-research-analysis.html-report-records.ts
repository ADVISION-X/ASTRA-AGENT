export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_EXPORT_KIND =
  "business-report.html" as const;

export const DEEP_RESEARCH_BUSINESS_HTML_MIME_TYPE = "text/html" as const;

export type DeepResearchBusinessHtmlSourceKind = "html_artifact" | "inline_html_document";

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
