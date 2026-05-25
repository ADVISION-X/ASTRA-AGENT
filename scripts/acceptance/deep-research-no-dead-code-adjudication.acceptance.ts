import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const fullCaseFile = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts", "utf8");
const finalization = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts", "utf8");
const parserSupport = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.parser-support.ts", "utf8");

const forbiddenRuntimeTerms = [
  "decideImportance",
  "filterImportant",
  "compactForJudgment",
  "summarizeOnly",
  "dropUnparsed",
] as const;

for (const term of forbiddenRuntimeTerms) {
  assert(!fullCaseFile.includes(term), `full case file builder must not contain ${term}.`);
  assert(!finalization.includes(term), `final adjudication runtime must not contain ${term}.`);
}

assert(fullCaseFile.includes("parse_failed_raw_available"), "parse failure with raw text must enter the full case file.");
assert(fullCaseFile.includes("rawResponseText"), "full case file must carry raw answer text.");
assert(parserSupport.includes("raw_text_preserved"), "parser support must preserve raw text when parsing cannot produce structured JSON.");

process.stdout.write("[ACCEPTANCE][deep-research-no-dead-code-adjudication] PASS\n");
