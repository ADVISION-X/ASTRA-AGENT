import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts", "utf8");

for (const required of [
  "buildResearchPlanFormatShell",
  "buildSubQuestionAnalysisFormatShell",
  "buildFinalAdjudicationFormatShell",
  "buildHtmlReportFormatShell",
  "ANSWER_TEXT_BEGIN",
  "ANSWER_TEXT_END",
  "INDEX_JSON_BEGIN",
  "INDEX_JSON_END",
  "indexNotes",
  "rawFinalAnswerText",
  "<!DOCTYPE html>",
  "summary-answer",
  "forensics-process",
  "business-conclusion",
  "n-stage-questions-and-answers",
  "Even if the AI-generated promptBundle mentions json_object, write the answer body as structured text",
  "Even if the AI-generated promptBundle mentions json_object, the final adjudication must still be written as structured text",
]) {
  assert(shell.includes(required), `Format shell must include ${required}.`);
}

for (const forbidden of [
  "Return the answer in the requested response envelope when possible.",
  "Minimal response envelope:",
]) {
  assert(!shell.includes(forbidden), `Format shell must not include ${forbidden}.`);
}

for (const forbidden of ["finalVerdict", "rankedConclusions", "directAnswer", "investmentThesis", "trainingFramework"]) {
  assert(!shell.includes(forbidden), `Runtime format shell must not define ${forbidden}.`);
}

process.stdout.write("[ACCEPTANCE][deep-research-format-shell-boundary] PASS\n");
