import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { renderDeepResearchFinalAdjudicationPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.js";
import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const finalizationText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts", "utf8");
const finalPromptText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts", "utf8");
const fixture = createDeepResearchFullCaseFixture();

try {
  const rendered = renderDeepResearchFinalAdjudicationPrompt({
    language: fixture.job.language,
    structuredIndex: fixture.finalPackage,
    fullCaseFile: fixture.fullCaseFile,
    fullCaseFileMarkdown: fixture.fullCaseFileMarkdown,
    finalAdjudicationPromptBundle: fixture.fullCaseFile.researchPlan.finalAdjudicationPromptBundle,
  });
  for (const marker of [
    "AI-GENERATED PROMPTBUNDLE",
    "Use the full case file as the source of truth.",
    "Do not ignore raw responses.",
    "Narrative raw-only analysis for Q2",
  ]) {
    assert(rendered.includes(marker), `Rendered final adjudication prompt must contain ${marker}.`);
  }
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

assert(finalPromptText.includes("Runtime shell for AI-generated finalAdjudicationPromptBundle."), "Final adjudication prompt must remain a runtime shell.");
assert(finalPromptText.includes("finalAdjudicationPromptBundle: DeepResearchPromptBundle"), "Final adjudication renderer must require an AI-generated promptBundle.");
assert(!finalPromptText.includes("buildDefaultFinalAdjudicationPromptBundle"), "Final adjudication fallback prompt builder must be deleted.");
assert(finalizationText.includes("finalAdjudicationPromptBundle: fullCaseFile.researchPlan.finalAdjudicationPromptBundle"), "Final adjudication phase must consume the AI-generated finalAdjudicationPromptBundle.");
assert(finalizationText.includes("parseDeepResearchFinalAdjudicationResponse(rawText)"), "Final adjudication parsing must consume the raw AI output directly.");

process.stdout.write("[ACCEPTANCE][deep-research-final-adjudication-ai-bundle] PASS\n");