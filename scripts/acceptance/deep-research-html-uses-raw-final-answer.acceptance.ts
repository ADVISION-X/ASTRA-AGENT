import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const htmlPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts", "utf8");
const htmlStage = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8");
const promptRender = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-render.ts", "utf8");

assert(htmlPrompt.includes("rawFinalAnswerText: input.finalAdjudication.rawFinalAnswerText"), "HTML prompt must pass rawFinalAnswerText.");
assert(htmlStage.includes("finalAdjudication: input.finalAdjudication"), "HTML stage must pass finalAdjudication.");
assert(promptRender.includes("FINAL ADJUDICATION RAW"), "HTML render must include raw final answer text.");
assert(promptRender.includes("FULL CASE FILE MARKDOWN"), "HTML render must include full case file markdown.");
assert(htmlPrompt.includes("htmlReportPromptBundle: DeepResearchPromptBundle"), "HTML prompt must use htmlReportPromptBundle.");

for (const forbidden of [
  "finalReport" + ".summary",
  "finalReport" + ".confidence",
  "finalReport" + ".structuredPayload",
]) {
  assert(!htmlPrompt.includes(forbidden), `HTML prompt must not depend on ${forbidden}.`);
  assert(!htmlStage.includes(forbidden), `HTML stage must not depend on ${forbidden}.`);
  assert(!promptRender.includes(forbidden), `HTML render must not depend on ${forbidden}.`);
}

process.stdout.write("[ACCEPTANCE][deep-research-html-uses-raw-final-answer] PASS\n");
