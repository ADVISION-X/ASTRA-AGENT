import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ciFullSummaryPath,
  writeCiFullSummary,
  type CiFullFirstFailure,
  type CiFullLawCoverage,
  type CiFullMetaQuality,
  type StepResult,
} from "../audit/ci-full.js";

const sampleSteps: StepResult[] = [
  {
    command: "npm run sample",
    durationMs: 42,
    endedAt: "2026-05-24T00:00:42.000Z",
    name: "sample-step",
    phase: "sample-phase",
    startedAt: "2026-05-24T00:00:00.000Z",
    status: "PASS",
  },
];

const lawCoverage: CiFullLawCoverage = {
  activeLawCount: 1,
  checked: true,
  plannedLawCount: 1,
  uncoveredLawIds: [],
};

const metaQuality: CiFullMetaQuality = {
  checked: true,
  findingCount: 0,
  reportPath: "scripts/audit/generated/audit-truth-report.generated.json",
};

const firstFailure: CiFullFirstFailure = {
  phase: "typecheck",
  command: "npm run typecheck",
  lawId: null,
  filePath: "tsconfig.json",
  message: "typecheck failed",
  minimalFixHint: "repair typecheck",
};

writeCiFullSummary({
  status: "FAIL",
  firstFailure,
  completedSteps: sampleSteps,
  skippedAfterFailure: [
    {
      command: "npm run later-step",
      name: "later-step",
      phase: "acceptance-runner",
    },
  ],
  lawCoverage,
  metaQuality,
  finalDecision: "FAIL",
});

const parsed = JSON.parse(readFileSync(ciFullSummaryPath, "utf8")) as {
  completedSteps: StepResult[];
  finalDecision: "PASS" | "FAIL";
  firstFailure: CiFullFirstFailure | null;
  generatedAt: string;
  lawCoverage: CiFullLawCoverage;
  metaQuality: CiFullMetaQuality;
  mode: string;
  skippedAfterFailure: Array<{ command: string; name: string; phase: string }>;
  status: "PASS" | "FAIL";
};

assert.equal(parsed.status, "FAIL", "ci summary writer should preserve fail-fast status.");
assert.equal(parsed.mode, "fail_fast", "ci summary writer must persist fail_fast mode.");
assert.equal(parsed.completedSteps.length, 1, "ci summary writer should persist completed steps.");
assert.equal(parsed.completedSteps[0]?.command, "npm run sample", "completed step must include command.");
assert.equal(typeof parsed.completedSteps[0]?.durationMs, "number", "completed step must include durationMs.");
assert.equal(typeof parsed.completedSteps[0]?.startedAt, "string", "completed step must include startedAt.");
assert.equal(typeof parsed.completedSteps[0]?.endedAt, "string", "completed step must include endedAt.");
assert.equal(parsed.firstFailure?.phase, "typecheck", "ci summary must persist firstFailure.phase.");
assert.equal(parsed.firstFailure?.command, "npm run typecheck", "ci summary must persist firstFailure.command.");
assert.equal(parsed.firstFailure?.filePath, "tsconfig.json", "ci summary must persist firstFailure.filePath.");
assert.equal(parsed.firstFailure?.message, "typecheck failed", "ci summary must persist firstFailure.message.");
assert.equal(parsed.firstFailure?.minimalFixHint, "repair typecheck", "ci summary must persist minimalFixHint.");
assert.equal(parsed.skippedAfterFailure.length, 1, "ci summary must persist skippedAfterFailure.");
assert.equal(parsed.skippedAfterFailure[0]?.name, "later-step", "skipped steps must retain their names.");
assert.equal(parsed.lawCoverage.activeLawCount, 1, "ci summary must persist law coverage summary.");
assert.equal(parsed.metaQuality.checked, true, "ci summary must persist meta-quality summary.");
assert.equal(parsed.finalDecision, "FAIL", "ci summary must persist finalDecision.");
assert.equal(typeof parsed.generatedAt, "string", "ci summary must include generatedAt.");

console.log("ci-summary-truth-acceptance-ok");