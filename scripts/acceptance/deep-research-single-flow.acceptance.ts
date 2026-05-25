import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");
const read = (path: string): string => readFileSync(path, "utf8");

const runner = read("src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts");
const finalPackage = read("src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts");

[
  "runDecompositionPhase",
  "runSubQuestionPhases",
  "buildFinalPackageStage",
  "runFinalReportPhase",
  "runBusinessHtmlReportPhase",
  "completeSuccessfulRun",
].forEach((symbol) => assert(runner.includes(symbol), `runner must include ${symbol}`));

assert(finalPackage.includes('"default_1_n_1_1"'), "flowMode must be default_1_n_1_1.");
assert(!runner.includes(decode("cnVuQnVzaW5lc3NEZWNrUGhhc2U=")), "runner must not include retired presentation phases.");
assert(!runner.includes(decode("cnVuUHB0QXJ0aWZhY3RQaGFzZQ==")), "runner must not include retired binary presentation phases.");

process.stdout.write("[ACCEPTANCE][deep-research-single-flow] PASS\n");
