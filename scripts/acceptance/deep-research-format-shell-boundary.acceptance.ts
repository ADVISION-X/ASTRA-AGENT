import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts", "utf8");

for (const required of [
  "buildResearchPlanFormatShell",
  "buildSubQuestionAnalysisFormatShell",
  "buildFinalAdjudicationFormatShell",
  "buildHtmlReportFormatShell",
  "answerText",
  "indexNotes",
  "rawFinalAnswerText",
  "<!DOCTYPE html>",
]) {
  assert(shell.includes(required), `Format shell must include ${required}.`);
}

for (const forbidden of ["finalVerdict", "rankedConclusions", "directAnswer", "investmentThesis", "trainingFramework"]) {
  assert(!shell.includes(forbidden), `Runtime format shell must not define ${forbidden}.`);
}

process.stdout.write("[ACCEPTANCE][deep-research-format-shell-boundary] PASS\n");
