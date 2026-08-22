import type { PlannedStep } from "./ci-full-phase-plan.js";
import {
  writeCiFullSummary,
  type CiFullFirstFailure,
  type CiFullLawCoverage,
  type CiFullOwnerReport,
  type CiFullSummaryInput,
  type StepResult,
} from "./ci-full-summary.js";

export type FailFast = (
  failingStepIndex: number,
  failure: CiFullFirstFailure,
  failedStep: StepResult,
) => never;

export const createFailFast = (
  completedSteps: StepResult[],
  getLawCoverage: () => CiFullLawCoverage,
  getOwnerReports: () => readonly CiFullOwnerReport[],
  getPlannedSteps: () => readonly PlannedStep[],
  writeSummary: (summary: CiFullSummaryInput) => void = writeCiFullSummary,
): FailFast => (failingStepIndex, failure, failedStep) => {
  completedSteps.push(failedStep);
  writeSummary({
    status: "FAIL",
    firstFailure: failure,
    completedSteps,
    skippedAfterFailure: getPlannedSteps().slice(failingStepIndex + 1)
      .map(([phase, name, command, ownerId, lawId, timeoutMs, clauseId, evidenceFacet]) => ({
        authorityStatus: ownerId === null || lawId === null ? "authority_not_reached" as const : "sealed" as const,
        clauseId,
        command,
        durationMs: 0,
        endedAt: null,
        evidenceFacet,
        lawId,
        name,
        ownerId,
        phase,
        startedAt: null,
        status: "SKIPPED" as const,
        timeoutMs,
      })),
    lawCoverage: getLawCoverage(),
    ownerReports: getOwnerReports(),
    finalDecision: "FAIL",
  });
  throw new Error("ci:full failed");
};
