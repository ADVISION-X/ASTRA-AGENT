import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const exportText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.export.ts", "utf8");
const recordContracts = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts", "utf8");
const routes = readFileSync("src/app/workbench-deep-research-routes.ts", "utf8");
const smoke = readFileSync("scripts/acceptance/deep-research-analysis-smoke.ts", "utf8");

for (const required of [
  "final-adjudication-raw.md",
  "full-case-file.md",
  "full-case-file.json",
  "structured-index.json",
  "business-report.html",
  "evidence-index.json",
]) {
  assert(recordContracts.includes(required), `Export contract must include ${required}.`);
  assert(routes.includes(required), `Routes must expose ${required}.`);
  assert(smoke.includes(required), `Smoke acceptance must cover ${required}.`);
}

for (const forbidden of [
  decode("cmVzZWFyY2gtcGxhbi5qc29u"),
  decode("cHJvbXB0LWJ1bmRsZXMuanNvbg=="),
  decode("ZGVjaXNpb24tcGFja2FnZS5qc29u"),
]) {
  assert(!recordContracts.includes(forbidden), `Export contract must not include ${forbidden}.`);
  assert(!routes.includes(forbidden), `Routes must not expose ${forbidden}.`);
  assert(!smoke.includes(forbidden), `Smoke acceptance must not require ${forbidden}.`);
  assert(!exportText.includes(forbidden), `Export pipeline must not write ${forbidden}.`);
}

assert(exportText.includes("structuredIndexArtifact"), "Export pipeline must persist structuredIndexArtifact.");
assert(exportText.includes("STRUCTURED_INDEX_EXPORT_KIND"), "Export pipeline must use the structured-index export kind constant.");

process.stdout.write("[ACCEPTANCE][deep-research-report-export] PASS\n");