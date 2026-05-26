import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    createDeepResearchFullCaseFixture,
    disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const fullCaseFileText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts", "utf8");
const fullCaseFileRenderText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts", "utf8");
const recordContractsText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.records.ts", "utf8");
const fixture = createDeepResearchFullCaseFixture();

try {
  assert(fixture.fullCaseFile.decomposition, "Fixture must include a decomposition record.");
  assert((fixture.fullCaseFile.decomposition?.renderedPromptText ?? "").length > 0, "Decomposition must persist renderedPromptText.");
  assert((fixture.fullCaseFile.decomposition?.rawResponseText ?? "").length > 0, "Decomposition must persist rawResponseText.");
  assert((fixture.fullCaseFile.decomposition?.rawResponseHash ?? "").length > 0, "Decomposition must persist rawResponseHash.");
  fixture.fullCaseFile.subQuestionAnalyses.forEach((entry) => {
    assert(entry.promptInteraction, `Sub-question ${entry.subQuestionId} must keep promptInteraction.`);
    assert((entry.promptInteraction?.renderedPromptText ?? "").length > 0, `Sub-question ${entry.subQuestionId} must persist renderedPromptText.`);
    assert((entry.promptInteraction?.rawResponseText ?? "").length > 0, `Sub-question ${entry.subQuestionId} must persist rawResponseText.`);
    assert((entry.promptInteraction?.rawResponseHash ?? "").length > 0, `Sub-question ${entry.subQuestionId} must persist rawResponseHash.`);
  });
  assert(fixture.fullCaseFile.failedButRawAvailableInteractions.length > 0, "Fixture must retain parse-failed raw interactions.");
  const rawOnly = fixture.fullCaseFile.failedButRawAvailableInteractions[0];
  assert((rawOnly?.renderedPromptText ?? "").length > 0, "Raw-only interaction must preserve renderedPromptText.");
  assert((rawOnly?.rawResponseText ?? "").length > 0, "Raw-only interaction must preserve rawResponseText.");
  assert((rawOnly?.rawResponseHash ?? "").length > 0, "Raw-only interaction must preserve rawResponseHash.");
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

for (const marker of ["renderedPromptText", "rawResponseText", "rawResponseHash"]) {
  assert(fullCaseFileText.includes(marker), `Full case file builder must include ${marker}.`);
  assert(fullCaseFileRenderText.includes(marker), `Full case file renderer must include ${marker}.`);
  assert(recordContractsText.includes(marker), `Record contracts must include ${marker}.`);
}

process.stdout.write("[ACCEPTANCE][deep-research-raw-response-sovereignty] PASS\n");