import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import { renderFinalAdjudicationFromPromptBundle } from "./deep-research-analysis.prompt-bundle-render.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import { buildPromptOutputShellContract } from "./deep-research-analysis.prompts.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

export const DEEP_RESEARCH_FINAL_ADJUDICATION_CONTRACT_ID =
  "deep-research.final-adjudication.shell.v2.0" as const;

export const buildFinalAdjudicationOutputContract = () => buildPromptOutputShellContract({
  contractId: DEEP_RESEARCH_FINAL_ADJUDICATION_CONTRACT_ID,
  format: "structured_text",
  requiredFields: ["rawFinalAnswerText"],
});

export const buildFinalAdjudicationShellPrompt = (): DeepResearchPrompt => ({
  promptId: "deep-research.final-adjudication",
  promptVersion: "v2.0.0",
  phase: "final_adjudication",
  promptText: "Runtime shell for AI-generated finalAdjudicationPromptBundle.",
  expectedOutputContract: buildFinalAdjudicationOutputContract(),
});

export const renderDeepResearchFinalAdjudicationPrompt = (input: {
  userQuestion?: string;
  analysisGoal?: string | null;
  language: DeepResearchInput["language"];
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  finalAdjudicationPromptBundle: DeepResearchPromptBundle;
}): string => renderFinalAdjudicationFromPromptBundle({
  language: input.language,
  structuredIndex: input.structuredIndex,
  fullCaseFile: input.fullCaseFile,
  fullCaseFileMarkdown: input.fullCaseFileMarkdown,
  finalAdjudicationPromptBundle: input.finalAdjudicationPromptBundle,
});
