import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import {
  renderDeepResearchHtmlArtifactShell,
  renderDeepResearchRuntimeShell,
} from "./deep-research-analysis.prompt-bundle-shell.js";
import type { DeepResearchInput, DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.final-package.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";

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
  renderDeepResearchRuntimeShell({
    preferredFormat: input.promptBundle.outputGuidance.preferredFormat,
  }),
  renderPromptBundleSection(input.promptBundle),
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
  renderDeepResearchRuntimeShell({
    preferredFormat: input.finalAdjudicationPromptBundle.outputGuidance.preferredFormat,
  }),
  "- Use the full case file as the source of truth.",
  "- Do not ignore raw responses.",
  renderPromptBundleSection(input.finalAdjudicationPromptBundle),
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
  renderDeepResearchHtmlArtifactShell(),
  renderPromptBundleSection(input.htmlReportPromptBundle),
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
  "Organize the HTML as a professional report according to the promptBundle.",
].join("\n\n");
