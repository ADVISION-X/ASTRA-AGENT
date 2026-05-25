import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const activeFiles = execFileSync("rg", [
  "--files",
  "src/plugins/deep-research-analysis",
  "src/app",
], { encoding: "utf8" }).trim().split("\n").filter((file) =>
  file.includes("deep-research") && file.endsWith(".ts")
);

const forbidden = [
  "legacy_1_n_n_1",
  "positiveAnswerRecords",
  "falsificationAnswerRecords",
  "conflictMatrix",
  "business-deck",
  "businessDeck",
  ".pptx",
] as const;

for (const file of activeFiles) {
  const text = readFileSync(file, "utf8");
  for (const term of forbidden) {
    assert(!text.includes(term), `${file} must not contain ${term}.`);
  }
}

process.stdout.write("[ACCEPTANCE][deep-research-no-legacy-no-ppt] PASS\n");
