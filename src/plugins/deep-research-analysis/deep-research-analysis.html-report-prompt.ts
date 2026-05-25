import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import { renderHtmlReportFromPromptBundle } from "./deep-research-analysis.prompt-bundle-render.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import { buildPromptOutputShellContract } from "./deep-research-analysis.prompts.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.result.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID =
  "deep-research.business-html-report-publisher" as const;
export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION = "v2.0.0" as const;
export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID =
  "deep-research.business-html-report.shell.v2.0" as const;

export const buildBusinessHtmlReportOutputContract = () => buildPromptOutputShellContract({
  contractId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID,
  format: "html_document",
  requiredFields: ["complete self-contained HTML document"],
});

export const buildBusinessHtmlReportShellPrompt = (): DeepResearchPrompt => ({
  promptId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_ID,
  promptVersion: DEEP_RESEARCH_BUSINESS_HTML_REPORT_PROMPT_VERSION,
  phase: "html_report",
  promptText: "Runtime shell for AI-generated htmlReportPromptBundle.",
  expectedOutputContract: buildBusinessHtmlReportOutputContract(),
});

export const renderDeepResearchBusinessHtmlReportPrompt = (input: {
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  htmlReportPromptBundle: DeepResearchPromptBundle;
  language: DeepResearchInput["language"];
}): string => renderHtmlReportFromPromptBundle({
  rawFinalAnswerText: input.finalAdjudication.rawFinalAnswerText,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  htmlReportPromptBundle: input.htmlReportPromptBundle,
  language: input.language,
});
