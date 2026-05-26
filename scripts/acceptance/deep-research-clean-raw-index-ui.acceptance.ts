import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const caseReader = readFileSync("src/app/workbench-deep-research-client-case-reader.ts", "utf8");
const shared = readFileSync("src/app/workbench-deep-research-client-shared.ts", "utf8");

assert(caseReader.includes("Clean Answer"), "UI must expose Clean Answer.");
assert(caseReader.includes("Raw AI Response"), "UI must expose Raw AI Response.");
assert(caseReader.includes("Index JSON"), "UI must expose Index JSON.");
assert(caseReader.includes("Index Notes"), "UI must expose Index Notes.");
assert(caseReader.includes("Rendered Prompt"), "UI must expose Rendered Prompt.");
assert(!shared.includes('renderExpandableText("Summary", block.answerText'), "UI must not label answerText as Summary.");

process.stdout.write("[ACCEPTANCE][deep-research-clean-raw-index-ui] PASS\n");