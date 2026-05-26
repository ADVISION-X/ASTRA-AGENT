import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const researchPlanSchema = read("src/plugins/deep-research-analysis/deep-research-analysis.schema.ts");
const decompositionPrompt = read("src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts");
const decompositionParser = read("src/plugins/deep-research-analysis/deep-research-analysis.parser.ts");
const finalPrompt = read("src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts");
const htmlPrompt = read("src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts");
const promptBundleRender = read("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts");

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
  "For subQuestions[].promptBundle, preferredFormat must be structured_text.",
  "For finalAdjudicationPromptBundle, preferredFormat must be structured_text.",
  "For htmlReportPromptBundle, preferredFormat must be html_document.",
]) {
  assert(decompositionPrompt.includes(marker), `Decomposition prompt must contain ${marker}.`);
}

for (const marker of [
  "sub_question_prompt_bundle_preferred_format_must_be_structured_text",
  "final_adjudication_prompt_bundle_preferred_format_must_be_structured_text",
  "html_report_prompt_bundle_preferred_format_must_be_html_document",
]) {
  assert(decompositionParser.includes(marker), `Decomposition parser must enforce ${marker}.`);
}

assert(!decompositionPrompt.includes("\"preferredFormat\": \"json_object | structured_text\""), "Decomposition prompt must not keep json_object as a sub/final preferredFormat option.");

assert(finalPrompt.includes("Runtime shell for AI-generated finalAdjudicationPromptBundle."), "Final adjudication prompt must stay a runtime shell.");
assert(finalPrompt.includes('format: "structured_text"'), "Final adjudication shell contract must use structured_text.");
assert(htmlPrompt.includes("Runtime shell for AI-generated htmlReportPromptBundle."), "HTML prompt must stay a runtime shell.");
assert(promptBundleRender.includes("AI-GENERATED PROMPTBUNDLE"), "Rendered prompts must surface the AI-generated promptBundle section.");
assert(!finalPrompt.includes("buildDefaultFinalAdjudicationPromptBundle"), "Final adjudication runtime must not introduce a replacement prompt builder.");

process.stdout.write("[ACCEPTANCE][deep-research-promptbundle-sovereignty] PASS\n");