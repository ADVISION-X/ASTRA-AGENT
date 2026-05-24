import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  businessPptArtifactSecretaryPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.js";

const deckStageText = readFileSync(
  "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts",
  "utf8",
);
const exportText = readFileSync(
  "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
  "utf8",
);

assert.equal(
  businessPptArtifactSecretaryPrompt.expectedOutputContract.format,
  "pptx_artifact",
  "Default deck prompt must target an AI PPTX artifact.",
);
assert(deckStageText.includes("businessPptArtifactSecretaryPrompt"));
assert(deckStageText.includes("parseAndDownloadBusinessPptArtifact"));
assert(deckStageText.includes('"business-deck.ai-pptx"'));
assert(!deckStageText.includes("parseDeepResearchBusinessDeckOutlineResponseForFinalReport"));
assert(!deckStageText.includes("business-deck-outline.json"));
assert(exportText.includes('"business-deck.ai-pptx"'));

process.stdout.write("[ACCEPTANCE][deep-research-ai-ppt-artifact] PASS\n");
