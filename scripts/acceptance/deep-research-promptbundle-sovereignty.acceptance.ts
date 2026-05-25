import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const researchPlanSchema = read("src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.ts");
const decompositionPrompt = read("src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts");
const finalPrompt = read("src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts");
const htmlPrompt = read("src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts");
const promptBundleRender = read("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-render.ts");

for (const marker of [
  "promptBundle:",
  "finalAdjudicationPromptBundle:",
  "htmlReportPromptBundle:",
  "finalPromptBundleIsQuestionSpecific",
  "htmlPromptBundleIsQuestionSpecific",
  "runtimeWillOnlyAddShellConstraints",
]) {
  assert(researchPlanSchema.includes(marker), `ResearchPlan schema must contain ${marker}.`);
}

for (const marker of [
  "Each subQuestion.promptBundle is the only business analysis instruction for that sub-question.",
  "The runtime will not write a replacement prompt later.",
  "The promptBundle may ask for output structures suitable for the question, but the runtime will not add business fields later.",
  "finalAdjudicationPromptBundle",
  "htmlReportPromptBundle",
]) {
  assert(decompositionPrompt.includes(marker), `Decomposition prompt must contain ${marker}.`);
}

assert(finalPrompt.includes("Runtime shell for AI-generated finalAdjudicationPromptBundle."), "Final adjudication prompt must stay a runtime shell.");
assert(htmlPrompt.includes("Runtime shell for AI-generated htmlReportPromptBundle."), "HTML prompt must stay a runtime shell.");
assert(promptBundleRender.includes("AI-GENERATED PROMPTBUNDLE"), "Rendered prompts must surface the AI-generated promptBundle section.");
assert(!finalPrompt.includes("buildDefaultFinalAdjudicationPromptBundle"), "Final adjudication fallback prompt builder must be deleted.");

process.stdout.write("[ACCEPTANCE][deep-research-promptbundle-sovereignty] PASS\n");