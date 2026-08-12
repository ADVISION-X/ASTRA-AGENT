import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generatedDir } from "./shared/paths.js";

export type StepResult = {
  command: string;
  durationMs: number;
  endedAt: string;
  error?: string | undefined;
  name: string;
  ownerId: string;
  lawId: string | null;
  phase: string;
  startedAt: string;
  status: "PASS" | "FAIL";
  timeoutMs: number;
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
  authorityStatus: "authority_not_reached" | "sealed";
  command: string;
  durationMs: 0;
  endedAt: null;
  lawId: string | null;
  name: string;
  ownerId: string | null;
  phase: string;
  startedAt: null;
  status: "SKIPPED";
  timeoutMs: number;
};

export type CiFullLawCoverage = {
  activeLawCount: number;
  activeClauseCount: number;
  boundClauseCount: number;
  checked: boolean;
  uncoveredClauseIds: string[];
};

export type CiFullOwnerReport = {
  capabilityDomain: string;
  findingCount: number;
  reportPath: string;
  status: "PASS" | "FAIL";
};

export const ciFullSummaryPath = resolve(generatedDir, "ci-full-summary.generated.json");

export const writeCiFullSummary = (summary: {
  completedSteps: readonly StepResult[];
  finalDecision: "PASS" | "FAIL";
  firstFailure: CiFullFirstFailure | null;
  lawCoverage: CiFullLawCoverage;
  ownerReports: readonly CiFullOwnerReport[];
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
        ownerReports: summary.ownerReports,
        finalDecision: summary.finalDecision,
      },
      null,
      2,
    )}\n`,
  );
};
