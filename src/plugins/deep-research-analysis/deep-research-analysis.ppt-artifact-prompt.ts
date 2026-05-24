import type { DeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import type { DeepResearchPrompt, DeepResearchPromptOutputContract } from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

export const DEEP_RESEARCH_BUSINESS_PPT_ARTIFACT_CONTRACT_ID =
  "deep-research.business-ppt-artifact.v1.0" as const;

const buildPptArtifactContract = (): DeepResearchPromptOutputContract => ({
  contractId: DEEP_RESEARCH_BUSINESS_PPT_ARTIFACT_CONTRACT_ID,
  format: "pptx_artifact",
  requiredFields: ["downloadable .pptx artifact"],
  forbiddenFields: ["unsupportedResearchExpansion", "contentRejudgment", "slideSemanticValidation"],
});

const businessPptArtifactSecretaryPromptValue: DeepResearchPrompt = {
  promptId: "deep-research.business-ppt-artifact-secretary",
  promptVersion: "v1.0.0",
  phase: "deck",
  promptText: [
    "You are the Business PPT Secretary for a Deep Research job.",
    "",
    "You are not a researcher.",
    "You are not a final adjudicator.",
    "You are not allowed to conduct deeper research.",
    "You are not allowed to change the final judgment.",
    "You are not allowed to add new facts.",
    "You are not allowed to add new sources.",
    "You are not allowed to remove or distort the original content.",
    "You are not allowed to weaken risks, limitations, evidence gaps, reverse conditions, rejected claims, or references.",
    "You are not allowed to change confidence, probability, verdict, ranking, or the user's final decision answer.",
    "",
    "Your only task is to organize the provided Deep Research final decision materials into a professional business PowerPoint presentation.",
    "",
    "Create a downloadable PowerPoint file (.pptx).",
    "",
    "Do not output only JSON.",
    "Do not output only markdown.",
    "Do not output only an outline.",
    "Do not ask me to create the PPT myself.",
    "Generate the PowerPoint file for download.",
    "",
    "The PPT must be suitable for executive/business decision presentation.",
    "Use clear slide titles, concise bullets, and speaker-friendly structure.",
    "",
    "The deck should normally include:",
    "1. Cover",
    "2. One-sentence decision",
    "3. Decision Card",
    "4. Ranked conclusions",
    "5. Why this judgment wins",
    "6. Key variables / logic map",
    "7. Risks and reverse conditions",
    "8. Evidence gaps and limitations",
    "9. Follow-up signals",
    "10. References / source notes",
    "",
    "Preserve the final decision package faithfully.",
    "You may reorganize and shorten wording for presentation clarity.",
    "You may improve layout and slide flow.",
    "You may choose professional slide titles.",
    "You must not change the meaning.",
  ].join("\n"),
  expectedOutputContract: buildPptArtifactContract(),
};

export const businessPptArtifactSecretaryPrompt = businessPptArtifactSecretaryPromptValue;

export const renderDeepResearchBusinessPptArtifactPrompt = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
  evidenceReferences: unknown[];
  language: DeepResearchInput["language"];
}): string => [
  businessPptArtifactSecretaryPrompt.promptText,
  "",
  "Deep Research final decision materials:",
  JSON.stringify({
    finalPackage: input.finalPackage,
    finalReport: input.finalReport,
    evidenceReferences: input.evidenceReferences,
  }, null, 2),
  "",
  `Response language:\n${input.language}`,
  "",
  "Generate the downloadable .pptx file now.",
].join("\n");
