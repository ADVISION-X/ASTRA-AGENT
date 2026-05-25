import assert from "node:assert/strict";
import { Project, SyntaxKind, Node } from "ts-morph";

import { renderDeepResearchFinalAdjudicationPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.js";
import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const fixture = createDeepResearchFullCaseFixture();
const project = new Project({ tsConfigFilePath: "tsconfig.json" });

try {
  const promptText = renderDeepResearchFinalAdjudicationPrompt({
    userQuestion: fixture.job.userQuestion,
    analysisGoal: fixture.job.analysisGoal,
    language: fixture.job.language,
    structuredIndex: fixture.finalPackage,
    fullCaseFile: fixture.fullCaseFile,
    fullCaseFileMarkdown: fixture.fullCaseFileMarkdown,
  });
  for (const marker of [
    "The structured index is for navigation.",
    "The full case file is the complete source of truth.",
    "If structured fields and raw responses differ, use the raw responses as primary evidence.",
    "Do not ignore raw responses that failed parsing.",
  ]) {
    assert.match(promptText, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(promptText, /Narrative raw-only analysis for Q2/u);

  const finalizationFile = project.getSourceFile(
    "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
  );
  assert(finalizationFile, "analysis finalization file must be visible to ts-morph.");
  const buildFullCaseCall = finalizationFile
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "buildDeepResearchFullCaseFile");
  assert(buildFullCaseCall, "analysis finalization must build the full case file.");
  const finalPromptCall = finalizationFile
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "renderDeepResearchFinalAdjudicationPrompt");
  assert(finalPromptCall, "analysis finalization must render the final adjudication prompt.");
  const finalPromptPayload = finalPromptCall?.getArguments()[0];
  assert(Node.isObjectLiteralExpression(finalPromptPayload), "Final adjudication prompt must receive an object literal payload.");
  assert(finalPromptPayload.getProperty("fullCaseFile"), "Final adjudication prompt payload must include fullCaseFile.");
  assert(finalPromptPayload.getProperty("fullCaseFileMarkdown"), "Final adjudication prompt payload must include fullCaseFileMarkdown.");
  assert.match(finalizationFile?.getFullText() ?? "", /full-case-file/u);
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

process.stdout.write("[ACCEPTANCE][deep-research-final-adjudication-full-input] PASS\n");