import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import type { AcceptanceLeafSkeleton } from "./ci-acceptance-leaf-plan.js";
import { AUDIT_PLAN_TIMEOUT_MS, runGeneratedPlanWithDeadline, type PlanRunResult } from "./ci-audit-plan-runner.js";
import { runBoundedCommand } from "./ci-command-runner.js";
import { createFailFast, type FailFast } from "./ci-fail-fast.js";
import { buildAcceptancePackageSkeletonsOrFail, sealCiPhasePlanOrFail } from "./ci-phase-sealer.js";
import {
  buildCiPlanSkeleton,
  codexEntryGateStep,
  preArtifactPlannedSteps,
  type CommandStep,
  type PlannedStep,
  typecheckStep,
} from "./ci-full-phase-plan.js";
import { writeCiFullSummary, type CiFullFirstFailure, type CiFullLawCoverage, type CiFullOwnerReport, type StepResult } from "./ci-full-summary.js";
import { resolveFromRepo } from "./shared/paths.js";
export type { CiFullFirstFailure, CiFullLawCoverage, CiFullOwnerReport, CiFullSkippedStep, StepResult } from "./ci-full-summary.js";
type GeneratedReportJson = {
  findings?: Array<{
    filePath?: string;
    lawId?: string;
    message?: string;
  }>;
};
type GeneratedReportFinding = NonNullable<GeneratedReportJson["findings"]>[number];
type LawRegistryJson = {
  laws: Array<{
    clauses: Array<{
      clauseId: string;
    }>;
    filePath: string;
    lawId: string;
    status: string;
  }>;
};

type AuditPlanJson = {
  entries: Array<{
    bindings: Array<{
      clauseId: string;
      lawId: string;
    }>;
  }>;
};

const generatedPlanLawId = preArtifactPlannedSteps
  .find(([phase]) => phase === "generated-plan-runner")?.[4] ?? null;
const generatedArtifactTruthLawId = preArtifactPlannedSteps
  .find(([phase]) => phase === "generated-artifact-truth")?.[4] ?? null;

const defaultLawCoverage = (): CiFullLawCoverage => ({
  activeLawCount: 0,
  activeClauseCount: 0,
  boundClauseCount: 0,
  checked: false,
  uncoveredClauseIds: [],
});

const readGeneratedJson = <T>(repoPath: string): T =>
  JSON.parse(readFileSync(resolveFromRepo(repoPath), "utf8")) as T;

const fileHasContent = (repoPath: string): boolean => {
  const absolutePath = resolveFromRepo(repoPath);
  return existsSync(absolutePath) && statSync(absolutePath).size > 2;
};

const createStepResult = (input: {
  command: string;
  clauseId?: string | null;
  error?: string | undefined;
  name: string;
  evidenceFacet?: import("./shared/law-contracts.js").ClauseEvidenceFacet | null;
  ownerId?: string;
  lawId?: string | null;
  phase: string;
  startedAtMs: number;
  status: "PASS" | "FAIL";
  timeoutMs?: number;
}): StepResult => {
  const endedAtMs = Date.now();
  return {
    clauseId: input.clauseId ?? null,
    command: input.command,
    durationMs: Math.max(0, endedAtMs - input.startedAtMs),
    endedAt: new Date(endedAtMs).toISOString(),
    evidenceFacet: input.evidenceFacet ?? null,
    name: input.name,
    ownerId: input.ownerId ?? "audit-system",
    lawId: input.lawId ?? null,
    phase: input.phase,
    startedAt: new Date(input.startedAtMs).toISOString(),
    status: input.status,
    timeoutMs: input.timeoutMs ?? 0,
    error: input.error,
  };
};

const createFirstFailure = (input: {
  command: string;
  filePath: string | null;
  lawId: string | null;
  message: string;
  minimalFixHint: string;
  phase: string;
}): CiFullFirstFailure => ({
  phase: input.phase,
  command: input.command,
  lawId: input.lawId,
  filePath: input.filePath,
  message: input.message,
  minimalFixHint: input.minimalFixHint,
});

const buildCommandFailure = (phase: string, stepSpec: CommandStep, step: StepResult): CiFullFirstFailure => {
  const [name, , filePathHint, lawIdHint, minimalFixHint] = stepSpec;
  return createFirstFailure({
    phase,
    command: step.command,
    lawId: lawIdHint,
    filePath: filePathHint,
    message: step.error ?? `${name} failed.`,
    minimalFixHint,
  });
};

const runAuditBuildStep = (): StepResult => {
  const startedAtMs = Date.now();
  buildAuditArtifacts();
  return createStepResult({
    command: "internal:buildAuditArtifacts()",
    name: "build-audit-artifacts",
    phase: "build-audit-artifacts",
    startedAtMs,
    status: "PASS",
  });
};

const readLawCoverage = (): {
  firstUncovered: { filePath: string; lawId: string; clauseId: string } | null;
  summary: CiFullLawCoverage;
} => {
  const registry = readGeneratedJson<LawRegistryJson>("scripts/audit/generated/law-registry.generated.json");
  const auditPlan = readGeneratedJson<AuditPlanJson>("scripts/audit/generated/audit-plan.generated.json");
  const activeLaws = registry.laws.filter((law) => law.status === "active");
  const activeClauses = activeLaws.flatMap((law) =>
    law.clauses.map((clause) => ({
      lawId: law.lawId,
      clauseId: clause.clauseId,
      filePath: law.filePath,
    })));
  const boundClauseKeys = new Set(
    auditPlan.entries.flatMap((entry) =>
      entry.bindings.map((binding) => `${binding.lawId}::${binding.clauseId}`)),
  );
  const uncovered = activeClauses.filter((clause) =>
    !boundClauseKeys.has(`${clause.lawId}::${clause.clauseId}`));
  return {
    summary: {
      activeLawCount: activeLaws.length,
      activeClauseCount: activeClauses.length,
      boundClauseCount: activeClauses.length - uncovered.length,
      checked: true,
      uncoveredClauseIds: uncovered.map((clause) => `${clause.lawId}/${clause.clauseId}`),
    },
    firstUncovered: uncovered[0]
      ? {
          filePath: uncovered[0].filePath,
          lawId: uncovered[0].lawId,
          clauseId: uncovered[0].clauseId,
        }
      : null,
  };
};

const runCommandStepOrFail = async (
  phase: string,
  failingStepIndex: number,
  stepSpec: CommandStep,
  completedSteps: StepResult[],
  failFast: FailFast,
): Promise<void> => {
  const step = await runBoundedCommand(phase, stepSpec);
  if (step.status === "FAIL") {
    failFast(failingStepIndex, buildCommandFailure(phase, stepSpec, step), step);
  }
  completedSteps.push(step);
};

const runAcceptancePhaseOrFail = async (
  acceptanceSteps: readonly CommandStep[],
  completedSteps: StepResult[],
  failFast: FailFast,
): Promise<void> => {
  for (const [index, acceptanceStep] of acceptanceSteps.entries()) {
    const step = await runBoundedCommand("acceptance-runner", acceptanceStep);
    if (step.status === "FAIL") {
      failFast(5 + index, buildCommandFailure("acceptance-runner", acceptanceStep, step), step);
    }
    completedSteps.push(step);
  }
};

const runActiveLawCoverageStep = (): {
  failure: CiFullFirstFailure | null;
  lawCoverage: CiFullLawCoverage;
  step: StepResult;
} => {
  const startedAtMs = Date.now();
  const coverage = readLawCoverage();
  const step = createStepResult({
    command: "internal:verifyActiveLawFullCoverage()",
    error: coverage.summary.uncoveredClauseIds.length > 0 ? "Active clauses are missing from the generated audit plan." : undefined,
    name: "active-law-full-coverage",
    phase: "active-law-full-coverage",
    startedAtMs,
    status: coverage.summary.uncoveredClauseIds.length > 0 ? "FAIL" : "PASS",
  });
  if (coverage.firstUncovered === null) {
    return {
      step,
      lawCoverage: coverage.summary,
      failure: null,
    };
  }
  return {
    step,
    lawCoverage: coverage.summary,
    failure: createFirstFailure({
      phase: step.phase,
      command: step.command,
      lawId: coverage.firstUncovered.lawId,
      filePath: coverage.firstUncovered.filePath,
      message: `Active clause ${coverage.firstUncovered.lawId}/${coverage.firstUncovered.clauseId} is missing from the generated audit plan.`,
      minimalFixHint: "Bind the missing active clause explicitly in its owner manifest, regenerate audit artifacts, and rerun ci:full.",
    }),
  };
};

const readFirstFindingFromReport = (reportPath: string): GeneratedReportFinding | null => {
  const report = readGeneratedJson<GeneratedReportJson>(reportPath);
  return report.findings?.[0] ?? null;
};

const buildPlanFailure = (input: {
  phase: string;
  command: string;
  defaultFilePath: string | null;
  defaultLawId: string | null;
  defaultMessage: string;
  defaultMinimalFixHint: string;
  planRun: PlanRunResult;
}): CiFullFirstFailure => {
  const failedReport = input.planRun.domainReports.find((report) => report.status === "FAIL");
  if (!failedReport) {
    return createFirstFailure({
      phase: input.phase,
      command: input.command,
      lawId: input.defaultLawId,
      filePath: input.defaultFilePath,
      message: input.defaultMessage,
      minimalFixHint: input.defaultMinimalFixHint,
    });
  }
  const firstFinding = readFirstFindingFromReport(failedReport.reportPath);
  return createFirstFailure({
    phase: input.phase,
    command: input.command,
    lawId: firstFinding?.lawId ?? input.defaultLawId,
    filePath: firstFinding?.filePath ?? failedReport.reportPath,
    message: firstFinding?.message ?? input.defaultMessage,
    minimalFixHint: input.defaultMinimalFixHint,
  });
};

const runAuditPlanStep = async (): Promise<{
  failure: CiFullFirstFailure | null;
  ownerReports: CiFullOwnerReport[];
  step: StepResult;
}> => {
  const startedAtMs = Date.now();
  let planRun: PlanRunResult;
  try {
    planRun = await runGeneratedPlanWithDeadline();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const step = createStepResult({
      command: "worker:runGeneratedPlan()",
      error: message,
      lawId: generatedPlanLawId,
      name: "generated-plan-runner",
      ownerId: "audit-system",
      phase: "generated-plan-runner",
      startedAtMs,
      status: "FAIL",
      timeoutMs: AUDIT_PLAN_TIMEOUT_MS,
    });
    return {
      step,
      ownerReports: [],
      failure: createFirstFailure({
        phase: step.phase,
        command: step.command,
        lawId: generatedPlanLawId,
        filePath: "scripts/audit/core/run-generated-plan-worker.ts",
        message,
        minimalFixHint: "Repair or bound the generated-plan owner execution before rerunning npm run ci:full.",
      }),
    };
  }
  const step = createStepResult({
    command: "worker:runGeneratedPlan()",
    error: planRun.hasFailures ? "One or more generated-plan owners reported findings." : undefined,
    name: "generated-plan-runner",
    ownerId: "audit-system",
    lawId: generatedPlanLawId,
    phase: "generated-plan-runner",
    startedAtMs,
    status: planRun.hasFailures ? "FAIL" : "PASS",
    timeoutMs: AUDIT_PLAN_TIMEOUT_MS,
  });
  return {
    step,
    ownerReports: planRun.domainReports.map((report) => ({
      capabilityDomain: report.capabilityDomain,
      findingCount: report.findingCount,
      reportPath: report.reportPath,
      status: report.status,
    })),
    failure: planRun.hasFailures
      ? buildPlanFailure({
          phase: step.phase,
          command: step.command,
          defaultFilePath: null,
          defaultLawId: null,
          defaultMessage: "One or more generated-plan owners reported findings.",
          defaultMinimalFixHint: "Repair the first failing domain report finding and rerun npm run ci:full.",
          planRun,
        })
      : null,
  };
};

const verifyGeneratedArtifactTruthStep = (): { failure: CiFullFirstFailure | null; step: StepResult } => {
  const startedAtMs = Date.now();
  const requiredGeneratedFiles = [
    "scripts/audit/generated/law-registry.generated.json",
    "scripts/audit/generated/audit-plan.generated.json",
    "scripts/audit/generated/enforcement-matrix.generated.json",
    "scripts/audit/generated/static-clause-coverage.generated.json",
  ] as const;
  const missingArtifact = requiredGeneratedFiles.find((repoPath) => !fileHasContent(repoPath));
  const coverageError = missingArtifact ? null : (() => {
    const artifact = JSON.parse(readFileSync(resolveFromRepo(
      "scripts/audit/generated/static-clause-coverage.generated.json",
    ), "utf8")) as {
      summary?: {
        activeClauseCount?: number; boundClauseCount?: number;
        machineFacetClauseCount?: number; executedMachineFacetClauseCount?: number;
        deferredRealChromeFacetCount?: number; realChromeFacetClauseIds?: string[];
        deferredRealProviderFacetCount?: number; realProviderFacetClauseIds?: string[];
        uncoveredMachineFacetClauseIds?: string[];
        coveragePercent?: number;
      };
    };
    const summary = artifact.summary;
    return summary
      && summary.activeClauseCount === summary.boundClauseCount
      && summary.machineFacetClauseCount === summary.executedMachineFacetClauseCount
      && summary.uncoveredMachineFacetClauseIds?.length === 0
      && summary.deferredRealChromeFacetCount === summary.realChromeFacetClauseIds?.length
      && summary.deferredRealProviderFacetCount === summary.realProviderFacetClauseIds?.length
      && summary.coveragePercent === 100
      ? null
      : "static-clause-coverage.generated.json does not prove 100% bound coverage plus 100% executed owner machine-facet coverage with real-Chrome and real-provider facets separately deferred.";
  })();
  const artifactError = missingArtifact ? `${missingArtifact} is missing or empty.` : coverageError;
  const step = createStepResult({
    command: "internal:verifyGeneratedArtifactTruth()",
    error: artifactError ?? undefined,
    name: "generated-artifact-truth",
    lawId: generatedArtifactTruthLawId,
    phase: "generated-artifact-truth",
    startedAtMs,
    status: artifactError ? "FAIL" : "PASS",
  });
  return {
    step,
    failure: artifactError
      ? createFirstFailure({
          phase: step.phase,
          command: step.command,
          lawId: generatedArtifactTruthLawId,
          filePath: missingArtifact ?? "scripts/audit/generated/static-clause-coverage.generated.json",
          message: artifactError,
          minimalFixHint: "Repair generated artifact emission so ci:full rebuilds the generated truth set before declaring PASS.",
        })
      : null,
  };
};

const runBuildAuditArtifactsOrFail = (completedSteps: StepResult[], failFast: FailFast): void => {
  const startedAtMs = Date.now();
  try {
    completedSteps.push(runAuditBuildStep());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedStep = createStepResult({
      command: "internal:buildAuditArtifacts()",
      error: message,
      name: "build-audit-artifacts",
      phase: "build-audit-artifacts",
      startedAtMs,
      status: "FAIL",
    });
    failFast(1, createFirstFailure({
      phase: "build-audit-artifacts",
      command: "internal:buildAuditArtifacts()",
      lawId: null,
      filePath: "scripts/audit/build-audit-artifacts.ts",
      message,
      minimalFixHint: "Repair the generated-audit artifact builder conflict and rerun npm run ci:full.",
    }), failedStep);
  }
};

const runGeneratedArtifactTruthOrFail = (
  plannedSteps: readonly PlannedStep[],
  completedSteps: StepResult[],
  failFast: FailFast,
): void => {
  const generatedArtifactTruthStep = verifyGeneratedArtifactTruthStep();
  if (generatedArtifactTruthStep.failure) {
    failFast(plannedSteps.length - 1, generatedArtifactTruthStep.failure, generatedArtifactTruthStep.step);
  }
  completedSteps.push(generatedArtifactTruthStep.step);
};

const main = async (): Promise<void> => {
  let acceptanceSkeletons: readonly AcceptanceLeafSkeleton[] = [];
  const completedSteps: StepResult[] = [];
  let lawCoverage = defaultLawCoverage();
  let ownerReports: CiFullOwnerReport[] = [];
  let currentPlannedSteps: readonly PlannedStep[] = preArtifactPlannedSteps;
  const failFast = createFailFast(
    completedSteps,
    () => lawCoverage,
    () => ownerReports,
    () => currentPlannedSteps,
  );

  await runCommandStepOrFail("codex-entry-gate", 0, codexEntryGateStep, completedSteps, failFast);
  runBuildAuditArtifactsOrFail(completedSteps, failFast);
  acceptanceSkeletons = buildAcceptancePackageSkeletonsOrFail(failFast);
  currentPlannedSteps = buildCiPlanSkeleton(acceptanceSkeletons);
  const phasePlan = sealCiPhasePlanOrFail(acceptanceSkeletons, failFast);
  currentPlannedSteps = phasePlan.plannedSteps;

  const lawCoverageStep = runActiveLawCoverageStep();
  lawCoverage = lawCoverageStep.lawCoverage;
  if (lawCoverageStep.failure) failFast(2, lawCoverageStep.failure, lawCoverageStep.step);
  completedSteps.push(lawCoverageStep.step);

  const auditPlanStep = await runAuditPlanStep();
  ownerReports = auditPlanStep.ownerReports;
  if (auditPlanStep.failure) failFast(3, auditPlanStep.failure, auditPlanStep.step);
  completedSteps.push(auditPlanStep.step);

  await runCommandStepOrFail("typecheck", 4, typecheckStep, completedSteps, failFast);
  await runAcceptancePhaseOrFail(phasePlan.acceptanceSteps, completedSteps, failFast);
  runGeneratedArtifactTruthOrFail(phasePlan.plannedSteps, completedSteps, failFast);

  writeCiFullSummary({
    status: "PASS",
    firstFailure: null,
    completedSteps,
    skippedAfterFailure: [],
    lawCoverage,
    ownerReports,
    finalDecision: "PASS",
  });

  process.stdout.write("[CI-FULL] PASS — entry gate, audit plan, typecheck, runtime log acceptance, and Amazon smoke passed.\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await main();
}
