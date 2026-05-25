import type { DeepResearchStructuredIndex } from "./deep-research-analysis.final-package.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import { renderFinalAdjudicationFromPromptBundle } from "./deep-research-analysis.prompt-bundle-render.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import { buildPromptOutputShellContract } from "./deep-research-analysis.prompts.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

export const finalAdjudicationShellPrompt: DeepResearchPrompt = {
  promptId: "deep-research.final-adjudication",
  promptVersion: "v2.0.0",
  phase: "final_adjudication",
  promptText: "Runtime shell for AI-generated finalAdjudicationPromptBundle.",
  expectedOutputContract: buildPromptOutputShellContract({
    contractId: "deep-research.final-adjudication.shell.v2.0",
  }),
};

export const finalAdjudicationPrompt = finalAdjudicationShellPrompt;

const buildDefaultFinalAdjudicationPromptBundle = (language: DeepResearchInput["language"]): DeepResearchPromptBundle => ({
  promptBundleId: "final-adjudication-default-prompt-bundle",
  promptRole: "final_adjudication",
  taskInstruction: "Adjudicate the full case file and return the final Deep Research decision report.",
  questionSpecificFocus: ["Use the persisted full case file and structured index as the complete record."],
  mustUseInputs: ["structuredIndex", "fullCaseFile", "fullCaseFileMarkdown"],
  mustNotDo: ["Do not ignore raw AI responses.", "Do not invent evidence outside the case file."],
  evidenceOrReasoningNeeds: ["Compare decisive reasons, opposing arguments, evidence gaps, and reverse conditions."],
  outputGuidance: {
    preferredFormat: "json_object",
    requiredContent: ["direct answer", "confidence", "decisive reasons", "evidence gaps", "reverse conditions"],
    optionalContent: ["ranked conclusions", "follow-up signals"],
    forbiddenContent: ["browser commands", "workflow instructions"],
  },
  safetyBoundary: ["The response is analysis, not guaranteed prediction."],
  languageInstruction: language === "zh-CN" ? "Respond in Simplified Chinese." : "Respond in English.",
});

export const renderDeepResearchFinalAdjudicationPrompt = (input: {
  userQuestion?: string;
  analysisGoal?: string | null;
  language: DeepResearchInput["language"];
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  finalAdjudicationPromptBundle?: DeepResearchPromptBundle;
}): string => renderFinalAdjudicationFromPromptBundle({
  language: input.language,
  structuredIndex: input.structuredIndex,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  finalAdjudicationPromptBundle: input.finalAdjudicationPromptBundle
    ?? buildDefaultFinalAdjudicationPromptBundle(input.language),
});
