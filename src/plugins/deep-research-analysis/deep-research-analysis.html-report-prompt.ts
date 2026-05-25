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

export const businessHtmlReportPublisherPrompt = businessHtmlReportShellPrompt;

const buildDefaultHtmlReportPromptBundle = (language: DeepResearchInput["language"]): DeepResearchPromptBundle => ({
  promptBundleId: "html-report-default-prompt-bundle",
  promptRole: "html_report_publisher",
  taskInstruction: "Create the final self-contained business-report.html artifact from the final report and full case file.",
  questionSpecificFocus: ["Turn the persisted final adjudication into a readable business decision report."],
  mustUseInputs: ["finalReport", "fullCaseFile", "fullCaseFileMarkdown"],
  mustNotDo: ["Do not output markdown fences.", "Do not link external CSS, JavaScript, or images."],
  evidenceOrReasoningNeeds: ["Show decision, confidence, reasons, evidence gaps, reverse conditions, and limitations."],
  outputGuidance: {
    preferredFormat: "html_document",
    requiredContent: ["complete self-contained HTML document", "inline CSS", "business decision report structure"],
    optionalContent: ["print CSS"],
    forbiddenContent: ["external scripts", "external stylesheets", "markdown fence"],
  },
  safetyBoundary: ["The report is AI analysis and must preserve uncertainty."],
  languageInstruction: language === "zh-CN" ? "Write report text in Simplified Chinese." : "Write report text in English.",
});

export const renderDeepResearchBusinessHtmlReportPrompt = (input: {
  structuredIndex?: unknown;
  finalReport: DeepResearchFinalReport;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  htmlReportPromptBundle?: DeepResearchPromptBundle;
  sourceNotes?: unknown[];
  language: DeepResearchInput["language"];
}): string => renderHtmlReportFromPromptBundle({
  finalReport: input.finalReport,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  htmlReportPromptBundle: input.htmlReportPromptBundle
    ?? buildDefaultHtmlReportPromptBundle(input.language),
  language: input.language,
});
