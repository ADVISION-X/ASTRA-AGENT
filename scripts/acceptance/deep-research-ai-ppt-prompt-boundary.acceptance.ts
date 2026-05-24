import assert from "node:assert/strict";

import {
  businessPptArtifactSecretaryPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.js";

const promptText = businessPptArtifactSecretaryPrompt.promptText;

for (const requiredText of [
  "not allowed to conduct deeper research",
  "not allowed to change the final judgment",
  "not allowed to add new facts",
  "not allowed to remove or distort the original content",
  "Create a downloadable PowerPoint file (.pptx).",
  "Do not output only JSON.",
  "Do not output only markdown.",
  "Do not output only an outline.",
] as const) {
  assert(promptText.includes(requiredText), `Missing PPT prompt boundary: ${requiredText}`);
}

assert.equal(businessPptArtifactSecretaryPrompt.expectedOutputContract.format, "pptx_artifact");

process.stdout.write("[ACCEPTANCE][deep-research-ai-ppt-prompt-boundary] PASS\n");
