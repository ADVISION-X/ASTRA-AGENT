import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import { renderHtmlReportFromPromptBundle } from "./deep-research-analysis.prompt-bundle-render.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import { buildPromptOutputShellContract } from "./deep-research-analysis.prompts.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID =
  "deep-research.business-html-report.shell.v2.0" as const;

export const businessHtmlReportShellPrompt: DeepResearchPrompt = {
  promptId: "deep-research.business-html-report-publisher",
  promptVersion: "v2.0.0",
  phase: "html_report",
  promptText: "Runtime shell for AI-generated htmlReportPromptBundle.",
  expectedOutputContract: buildPromptOutputShellContract({
    contractId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID,
    format: "html_artifact",
    requiredFields: ["complete self-contained HTML document"],
  }),
};

export const renderDeepResearchBusinessHtmlReportPrompt = (input: {
  finalReport: DeepResearchFinalReport;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  htmlReportPromptBundle: DeepResearchPromptBundle;
  language: DeepResearchInput["language"];
}): string => renderHtmlReportFromPromptBundle({
  finalReport: input.finalReport,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  htmlReportPromptBundle: input.htmlReportPromptBundle,
  language: input.language,
});
