import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const promptBundleShell = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts", "utf8");
const analysisSubQuestions = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts", "utf8");
const finalPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts", "utf8");
const htmlPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts", "utf8");

for (const marker of [
  "Preserve analytical content even if formatting is imperfect.",
  "The raw response will be persisted exactly as returned.",
  "Return the requested format when possible.",
  "Do not output system operation instructions.",
  "Do not invent unavailable evidence.",
]) {
  assert(promptBundleShell.includes(marker), `Runtime shell must contain ${marker}.`);
}

for (const marker of [
  "Return one complete self-contained HTML document.",
  "Use inline CSS only.",
  "Do not include scripts.",
  "Do not depend on external CSS, fonts, images, or network resources.",
]) {
  assert(promptBundleShell.includes(marker), `HTML runtime shell must contain ${marker}.`);
}

for (const text of [analysisSubQuestions, finalPrompt, htmlPrompt]) {
  assert(text.includes("Runtime shell"), "Deep Research prompt stages must remain shell-driven.");
}

for (const forbidden of [
  "stock",
  "crypto",
  "war",
  "military",
  "training plan",
  "investment thesis",
  "tax filing",
  "rankedConclusions",
  "finalVerdict",
]) {
  assert(!promptBundleShell.includes(forbidden), `Runtime shell must not include domain prompt fragment ${forbidden}.`);
  assert(!finalPrompt.includes(forbidden), `Final prompt shell must not include domain prompt fragment ${forbidden}.`);
  assert(!htmlPrompt.includes(forbidden), `HTML prompt shell must not include domain prompt fragment ${forbidden}.`);
}

process.stdout.write("[ACCEPTANCE][deep-research-runtime-shell-only] PASS\n");