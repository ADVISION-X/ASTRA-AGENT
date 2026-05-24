import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ciFullSummaryPath, writeCiFullSummary, type StepResult } from "../audit/ci-full.js";

const sampleSteps: StepResult[] = [
  {
    command: "npm run sample",
    durationMs: 42,
    endedAt: "2026-05-24T00:00:42.000Z",
    name: "sample-step",
    startedAt: "2026-05-24T00:00:00.000Z",
    status: "PASS",
  },
];

writeCiFullSummary({
  status: "PASS",
  steps: sampleSteps,
  domains: [
    {
      capabilityDomain: "sample-domain",
      executionGroup: "meta",
      status: "PASS",
      findingCount: 0,
      reportPath: "scripts/audit/generated/sample-domain-report.generated.json",
    },
  ],
});

const parsed = JSON.parse(readFileSync(ciFullSummaryPath, "utf8")) as {
  generatedAt: string;
  status: "PASS" | "FAIL";
  steps: StepResult[];
};

assert.equal(parsed.status, "PASS", "ci summary writer should preserve overall status.");
assert.equal(parsed.steps.length, 1, "ci summary writer should persist each step.");
assert.equal(parsed.steps[0]?.command, "npm run sample", "ci summary step must include command.");
assert.equal(typeof parsed.steps[0]?.durationMs, "number", "ci summary step must include durationMs.");
assert.equal(typeof parsed.steps[0]?.startedAt, "string", "ci summary step must include startedAt.");
assert.equal(typeof parsed.steps[0]?.endedAt, "string", "ci summary step must include endedAt.");
assert.equal(typeof parsed.generatedAt, "string", "ci summary must include generatedAt.");

console.log("ci-summary-truth-acceptance-ok");