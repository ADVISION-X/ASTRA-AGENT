import assert from "node:assert/strict";

import {
  businessHtmlReportPublisherPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.js";

const promptText = businessHtmlReportPublisherPrompt.promptText;

for (const requiredText of [
  "not allowed to conduct deeper research",
  "not allowed to change the final judgment",
  "not allowed to add new facts",
  "not allowed to add new sources",
  "not allowed to remove or distort the original content",
  "Create a downloadable HTML file artifact named business-report.html.",
  "Use inline CSS inside a <style> tag.",
  "Do not depend on external JavaScript, external CSS, external fonts, or remote images.",
  "Do not include scripts.",
  "Do not use external network resources.",
  "The file content must start with <!DOCTYPE html>.",
  "Do not paste the HTML source into the chat response body.",
  "Do not wrap the HTML in markdown fences.",
  "Do not output commentary before or after creating the file artifact.",
  "Do not output only JSON.",
  "Do not output only markdown.",
  "Do not output only an outline.",
] as const) {
  assert(
    promptText.includes(requiredText),
    `Missing HTML prompt boundary: ${requiredText}`,
  );
}

assert.equal(
  businessHtmlReportPublisherPrompt.expectedOutputContract.format,
  "html_artifact",
);
assert(
  !promptText.includes("Return a complete HTML document."),
  "HTML prompt must not ask GPT to paste a raw HTML document into chat.",
);
assert.deepEqual(
  businessHtmlReportPublisherPrompt.expectedOutputContract.forbiddenFields,
  ["unsupportedResearchExpansion", "contentRejudgment", "externalResources", "scripts"],
  "HTML report prompt contract must explicitly forbid runtime re-judgment and external/script output.",
);

process.stdout.write("[ACCEPTANCE][deep-research-html-prompt-boundary] PASS\n");
