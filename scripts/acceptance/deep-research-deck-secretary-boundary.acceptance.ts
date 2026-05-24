import assert from "node:assert/strict";

import {
  businessPptArtifactSecretaryPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.js";

const promptText = businessPptArtifactSecretaryPrompt.promptText;

for (const requiredText of [
  "You are not a researcher.",
  "You are not a final adjudicator.",
  "You are not allowed to conduct deeper research.",
  "You are not allowed to change the final judgment.",
  "You are not allowed to add new facts.",
  "You are not allowed to add new sources.",
  "You are not allowed to remove or distort the original content.",
  "Create a downloadable PowerPoint file (.pptx).",
  "Do not output only JSON.",
  "Do not output only markdown.",
  "Do not output only an outline.",
  "Generate the PowerPoint file for download.",
] as const) {
  assert(promptText.includes(requiredText), `Business PPT artifact prompt must include: ${requiredText}`);
}

assert.equal(
  businessPptArtifactSecretaryPrompt.expectedOutputContract.format,
  "pptx_artifact",
  "Business PPT secretary must target a downloadable PPTX artifact, not a JSON outline.",
);

process.stdout.write("[ACCEPTANCE][deep-research-deck-secretary-boundary] PASS\n");
