import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import {
  buildFinalAdjudicationFormatShell,
  buildHtmlReportFormatShell,
  buildSubQuestionAnalysisFormatShell,
} from "./deep-research-analysis.prompt-bundle-shell.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchInput, DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

const buildSection = (title: string, value: unknown): string =>
  `${title}:\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`;

const renderPromptBundleSection = (promptBundle: DeepResearchPromptBundle): string =>
  buildSection("AI-GENERATED PROMPTBUNDLE", promptBundle);

export const renderSubQuestionAnalysisFromPromptBundle = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  subQuestion: DeepResearchSubQuestion;
  promptBundle: DeepResearchPromptBundle;
}): string => [
  renderPromptBundleSection(input.promptBundle),
  buildSubQuestionAnalysisFormatShell(),
  buildSection("CONTEXT", {
    userQuestion: input.userQuestion,
    analysisGoal: input.analysisGoal,
    responseLanguage: input.language,
    subQuestion: input.subQuestion,
  }),
].join("\n\n");

export const renderFinalAdjudicationFromPromptBundle = (input: {
  language: DeepResearchInput["language"];
  finalAdjudicationPromptBundle: DeepResearchPromptBundle;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  structuredIndex: DeepResearchStructuredIndex;
}): string => [
  renderPromptBundleSection(input.finalAdjudicationPromptBundle),
  "Use the full case file as the source of truth.",
  "The structured index is for navigation.",
  "If structured fields and raw responses differ, use the raw responses as primary evidence.",
  "Do not ignore raw responses.",
  "Do not ignore raw responses that failed parsing.",
  buildFinalAdjudicationFormatShell(),
  buildSection("CONTEXT", {
    responseLanguage: input.language,
    structuredIndex: input.structuredIndex,
    fullCaseFile: {
      caseFileVersion: input.fullCaseFile.caseFileVersion,
      job: input.fullCaseFile.job,
      coverage: input.fullCaseFile.coverage,
      failedButRawAvailableInteractionCount: input.fullCaseFile.failedButRawAvailableInteractions.length,
    },
  }),
  buildSection("FULL CASE FILE MARKDOWN", input.fullCaseFileMarkdown),
].join("\n\n");

export const renderHtmlReportFromPromptBundle = (input: {
  language: DeepResearchInput["language"];
  htmlReportPromptBundle: DeepResearchPromptBundle;
  finalReport: DeepResearchFinalReport;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
}): string => [
  renderPromptBundleSection(input.htmlReportPromptBundle),
  "Organize the HTML as a professional report according to the promptBundle.",
  buildHtmlReportFormatShell(),
  buildSection("CONTEXT", {
    responseLanguage: input.language,
    finalReport: input.finalReport,
    fullCaseFile: {
      caseFileVersion: input.fullCaseFile.caseFileVersion,
      job: input.fullCaseFile.job,
      coverage: input.fullCaseFile.coverage,
      failedButRawAvailableInteractionCount: input.fullCaseFile.failedButRawAvailableInteractions.length,
    },
  }),
  buildSection("FULL CASE FILE MARKDOWN", input.fullCaseFileMarkdown),
].join("\n\n");
