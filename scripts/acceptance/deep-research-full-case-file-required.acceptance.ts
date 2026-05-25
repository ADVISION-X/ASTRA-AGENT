import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const fullCaseFile = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts", "utf8");
const fullCaseFileExport = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-export.ts", "utf8");
const finalPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts", "utf8");
const htmlPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts", "utf8");

assert(fullCaseFile.includes("rawResponseText"), "full case file must include raw responses.");
assert(fullCaseFile.includes("renderedPromptText"), "full case file must include rendered prompts.");
assert(fullCaseFileExport.includes("full-case-file.json"), "full-case-file.json export is required.");
assert(fullCaseFileExport.includes("full-case-file.md"), "full-case-file.md export is required.");
assert(finalPrompt.includes("fullCaseFile"), "final adjudication prompt must include fullCaseFile.");
assert(htmlPrompt.includes("fullCaseFile"), "HTML prompt must include fullCaseFile.");

process.stdout.write("[ACCEPTANCE][deep-research-full-case-file-required] PASS\n");
