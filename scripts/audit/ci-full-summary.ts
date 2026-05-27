import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generatedDir } from "./shared/paths.js";

export type StepResult = {
  command: string;
  durationMs: number;
  endedAt: string;
  error?: string | undefined;
  name: string;
  phase: string;
  startedAt: string;
  status: "PASS" | "FAIL";
};

export type CiFullFirstFailure = {
  command: string;
  filePath: string | null;
  lawId: string | null;
  message: string;
  minimalFixHint: string;
  phase: string;
};

export type CiFullSkippedStep = {
  command: string;
  name: string;
  phase: string;
};

export type CiFullLawCoverage = {
  activeLawCount: number;
  checked: boolean;
  plannedLawCount: number;
  uncoveredLawIds: string[];
};

export type CiFullMetaQuality = {
  checked: boolean;
  findingCount: number | null;
  reportPath: string | null;
};

export const ciFullSummaryPath = resolve(generatedDir, "ci-full-summary.generated.json");

export const writeCiFullSummary = (summary: {
  completedSteps: readonly StepResult[];
  finalDecision: "PASS" | "FAIL";
  firstFailure: CiFullFirstFailure | null;
  lawCoverage: CiFullLawCoverage;
  metaQuality: CiFullMetaQuality;
  skippedAfterFailure: readonly CiFullSkippedStep[];
  status: "PASS" | "FAIL";
}): void => {
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(
    ciFullSummaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: "fail_fast",
        status: summary.status,
        firstFailure: summary.firstFailure,
        completedSteps: summary.completedSteps,
        skippedAfterFailure: summary.skippedAfterFailure,
        lawCoverage: summary.lawCoverage,
        metaQuality: summary.metaQuality,
        finalDecision: summary.finalDecision,
      },
      null,
      2,
    )}\n`,
  );
};