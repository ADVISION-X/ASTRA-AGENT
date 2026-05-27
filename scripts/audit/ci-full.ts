import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import { acceptanceSteps, codexEntryGateStep, plannedSteps, type CommandStep, typecheckStep } from "./ci-full-phase-plan.js";
import { writeCiFullSummary, type CiFullFirstFailure, type CiFullLawCoverage, type CiFullMetaQuality, type StepResult } from "./ci-full-summary.js";
import { runGeneratedPlanFiltered } from "./core/run-generated-plan.js";
import { repoRoot, resolveFromRepo } from "./shared/paths.js";

export { ciFullSummaryPath, writeCiFullSummary } from "./ci-full-summary.js";
export type { CiFullFirstFailure, CiFullLawCoverage, CiFullMetaQuality, CiFullSkippedStep, StepResult } from "./ci-full-summary.js";

type PlanRunResult = Awaited<ReturnType<typeof runGeneratedPlanFiltered>>;

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
    filePath: string;
    lawId: string;
    status: string;
  }>;
};

type AuditPlanJson = {
  entries: Array<{
    lawIds: string[];
  }>;
};

const defaultLawCoverage = (): CiFullLawCoverage => ({
  activeLawCount: 0,
  checked: false,
  plannedLawCount: 0,
  uncoveredLawIds: [],
});

const defaultMetaQuality = (): CiFullMetaQuality => ({
  checked: false,
  findingCount: null,
  reportPath: null,
});

const readGeneratedJson = <T>(repoPath: string): T =>
  JSON.parse(readFileSync(resolveFromRepo(repoPath), "utf8")) as T;

const fileHasContent = (repoPath: string): boolean => {
  const absolutePath = resolveFromRepo(repoPath);
  return existsSync(absolutePath) && statSync(absolutePath).size > 2;
};

const createStepResult = (input: {
  command: string;
  error?: string | undefined;
  name: string;
  phase: string;
  startedAtMs: number;
  status: "PASS" | "FAIL";
}): StepResult => {
  const endedAtMs = Date.now();
  return {
    command: input.command,
    durationMs: Math.max(0, endedAtMs - input.startedAtMs),
    endedAt: new Date(endedAtMs).toISOString(),
    name: input.name,
    phase: input.phase,
    startedAt: new Date(input.startedAtMs).toISOString(),
    status: input.status,
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

const runCommand = async (phase: string, stepSpec: CommandStep): Promise<StepResult> => {
  const [name, command] = stepSpec;
  const startedAtMs = Date.now();
  process.stdout.write(`[CI-FULL][RUN] ${name}\n`);
  const [executable, ...args] = command;
  const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
  if (exitCode === 0) {
    process.stdout.write(`[CI-FULL][PASS] ${name}\n`);
    return createStepResult({
      command: command.join(" "),
      name,
      phase,
      startedAtMs,
      status: "PASS",
    });
  }
  return createStepResult({
    command: command.join(" "),
    error: `${name} failed with exit code ${exitCode}`,
    name,
    phase,
    startedAtMs,
    status: "FAIL",
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
  firstUncovered: { filePath: string; lawId: string } | null;
  summary: CiFullLawCoverage;
} => {
  const registry = readGeneratedJson<LawRegistryJson>("scripts/audit/generated/law-registry.generated.json");
  const auditPlan = readGeneratedJson<AuditPlanJson>("scripts/audit/generated/audit-plan.generated.json");
  const activeLaws = registry.laws.filter((law) => law.status === "active");
  const plannedLawIds = new Set(auditPlan.entries.flatMap((entry) => entry.lawIds));
  const uncovered = activeLaws.filter((law) => !plannedLawIds.has(law.lawId));
  return {
    summary: {
      activeLawCount: activeLaws.length,
      checked: true,
      plannedLawCount: plannedLawIds.size,
      uncoveredLawIds: uncovered.map((law) => law.lawId),
    },
    firstUncovered: uncovered[0]
      ? {
          filePath: uncovered[0].filePath,
          lawId: uncovered[0].lawId,
        }
      : null,
  };
};

type FailFast = (failingStepIndex: number, failure: CiFullFirstFailure) => never;

const runCommandStepOrFail = async (
  phase: string,
  failingStepIndex: number,
  stepSpec: CommandStep,
  completedSteps: StepResult[],
  failFast: FailFast,
): Promise<void> => {
  const step = await runCommand(phase, stepSpec);
  if (step.status === "FAIL") {
    failFast(failingStepIndex, buildCommandFailure(phase, stepSpec, step));
  }
  completedSteps.push(step);
};

const runAcceptancePhaseOrFail = async (completedSteps: StepResult[], failFast: FailFast): Promise<void> => {
  for (const [index, acceptanceStep] of acceptanceSteps.entries()) {
    const step = await runCommand("acceptance-runner", acceptanceStep);
    if (step.status === "FAIL") {
      failFast(6 + index, buildCommandFailure("acceptance-runner", acceptanceStep, step));
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
    error: coverage.summary.uncoveredLawIds.length > 0 ? "Active laws are missing from the generated audit plan." : undefined,
    name: "active-law-full-coverage",
    phase: "active-law-full-coverage",
    startedAtMs,
    status: coverage.summary.uncoveredLawIds.length > 0 ? "FAIL" : "PASS",
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
      message: `Active law ${coverage.firstUncovered.lawId} is missing from the generated audit plan.`,
      minimalFixHint: "Regenerate audit artifacts and connect the missing active law to an owner manifest before rerunning ci:full.",
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

const runMetaQualityStep = async (): Promise<{
  failure: CiFullFirstFailure | null;
  metaQuality: CiFullMetaQuality;
  step: StepResult;
}> => {
  const startedAtMs = Date.now();
  const planRun = await runGeneratedPlanFiltered({
    capabilityDomains: ["audit-truth"],
  });
  const report = planRun.domainReports[0];
  const step = createStepResult({
    command: 'internal:runGeneratedPlanFiltered({ capabilityDomains: ["audit-truth"] })',
    error: planRun.hasFailures ? "Meta-quality reported findings." : undefined,
    name: "meta-quality",
    phase: "meta-quality",
    startedAtMs,
    status: planRun.hasFailures ? "FAIL" : "PASS",
  });
  return {
    step,
    metaQuality: {
      checked: true,
      findingCount: report?.findingCount ?? 0,
      reportPath: report?.reportPath ?? null,
    },
    failure: planRun.hasFailures
      ? buildPlanFailure({
          phase: step.phase,
          command: step.command,
          defaultFilePath: report?.reportPath ?? null,
          defaultLawId: null,
          defaultMessage: "Meta-quality reported findings.",
          defaultMinimalFixHint: "Repair the first audit-truth finding and rerun npm run ci:full.",
          planRun,
        })
      : null,
  };
};

const runDomainAuditStep = async (): Promise<{ failure: CiFullFirstFailure | null; step: StepResult }> => {
  const startedAtMs = Date.now();
  const planRun = await runGeneratedPlanFiltered({
    excludeCapabilityDomains: ["audit-truth"],
  });
  const step = createStepResult({
    command: 'internal:runGeneratedPlanFiltered({ excludeCapabilityDomains: ["audit-truth"] })',
    error: planRun.hasFailures ? "One or more non-meta audit domains reported findings." : undefined,
    name: "domain-audit-runner",
    phase: "domain-audit-runner",
    startedAtMs,
    status: planRun.hasFailures ? "FAIL" : "PASS",
  });
  return {
    step,
    failure: planRun.hasFailures
      ? buildPlanFailure({
          phase: step.phase,
          command: step.command,
          defaultFilePath: null,
          defaultLawId: null,
          defaultMessage: "One or more non-meta audit domains reported findings.",
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
  const step = createStepResult({
    command: "internal:verifyGeneratedArtifactTruth()",
    error: missingArtifact ? `${missingArtifact} is missing or empty.` : undefined,
    name: "generated-artifact-truth",
    phase: "generated-artifact-truth",
    startedAtMs,
    status: missingArtifact ? "FAIL" : "PASS",
  });
  return {
    step,
    failure: missingArtifact
      ? createFirstFailure({
          phase: step.phase,
          command: step.command,
          lawId: null,
          filePath: missingArtifact,
          message: `${missingArtifact} is missing or empty after ci:full execution.`,
          minimalFixHint: "Repair generated artifact emission so ci:full rebuilds the generated truth set before declaring PASS.",
        })
      : null,
  };
};

const createFailFast = (
  completedSteps: StepResult[],
  getLawCoverage: () => CiFullLawCoverage,
  getMetaQuality: () => CiFullMetaQuality,
): FailFast => (failingStepIndex, failure) => {
  writeCiFullSummary({
    status: "FAIL",
    firstFailure: failure,
    completedSteps,
    skippedAfterFailure: plannedSteps.slice(failingStepIndex + 1).map(([phase, name, command]) => ({
      command,
      name,
      phase,
    })),
    lawCoverage: getLawCoverage(),
    metaQuality: getMetaQuality(),
    finalDecision: "FAIL",
  });
  throw new Error("ci:full failed");
};

const runBuildAuditArtifactsOrFail = (completedSteps: StepResult[], failFast: FailFast): void => {
  try {
    completedSteps.push(runAuditBuildStep());
  } catch (error) {
    failFast(1, createFirstFailure({
      phase: "build-audit-artifacts",
      command: "internal:buildAuditArtifacts()",
      lawId: null,
      filePath: "scripts/audit/build-audit-artifacts.ts",
      message: error instanceof Error ? error.message : String(error),
      minimalFixHint: "Repair the generated-audit artifact builder conflict and rerun npm run ci:full.",
    }));
  }
};

const runLawCoverageOrFail = (
  completedSteps: StepResult[],
  failFast: FailFast,
): CiFullLawCoverage => {
  const lawCoverageStep = runActiveLawCoverageStep();
  if (lawCoverageStep.failure) {
    failFast(2, lawCoverageStep.failure);
  }
  completedSteps.push(lawCoverageStep.step);
  return lawCoverageStep.lawCoverage;
};

const runMetaQualityOrFail = async (
  completedSteps: StepResult[],
  failFast: FailFast,
): Promise<CiFullMetaQuality> => {
  const metaQualityStep = await runMetaQualityStep();
  if (metaQualityStep.failure) {
    failFast(3, metaQualityStep.failure);
  }
  completedSteps.push(metaQualityStep.step);
  return metaQualityStep.metaQuality;
};

const runDomainAuditOrFail = async (completedSteps: StepResult[], failFast: FailFast): Promise<void> => {
  const domainAuditStep = await runDomainAuditStep();
  if (domainAuditStep.failure) {
    failFast(5, domainAuditStep.failure);
  }
  completedSteps.push(domainAuditStep.step);
};

const runGeneratedArtifactTruthOrFail = (completedSteps: StepResult[], failFast: FailFast): void => {
  const generatedArtifactTruthStep = verifyGeneratedArtifactTruthStep();
  if (generatedArtifactTruthStep.failure) {
    failFast(plannedSteps.length - 1, generatedArtifactTruthStep.failure);
  }
  completedSteps.push(generatedArtifactTruthStep.step);
};

const main = async (): Promise<void> => {
  const completedSteps: StepResult[] = [];
  let lawCoverage = defaultLawCoverage();
  let metaQuality = defaultMetaQuality();
  const failFast = createFailFast(completedSteps, () => lawCoverage, () => metaQuality);

  await runCommandStepOrFail("codex-entry-gate", 0, codexEntryGateStep, completedSteps, failFast);
  runBuildAuditArtifactsOrFail(completedSteps, failFast);
  lawCoverage = runLawCoverageOrFail(completedSteps, failFast);
  metaQuality = await runMetaQualityOrFail(completedSteps, failFast);

  await runCommandStepOrFail("typecheck", 4, typecheckStep, completedSteps, failFast);
  await runDomainAuditOrFail(completedSteps, failFast);
  await runAcceptancePhaseOrFail(completedSteps, failFast);
  runGeneratedArtifactTruthOrFail(completedSteps, failFast);

  writeCiFullSummary({
    status: "PASS",
    firstFailure: null,
    completedSteps,
    skippedAfterFailure: [],
    lawCoverage,
    metaQuality,
    finalDecision: "PASS",
  });

  process.stdout.write("[CI-FULL] PASS — entry gate, audit plan, typecheck, runtime log acceptance, Deep Research smoke, single-chain/raw/full-case/format-shell/no-confidence/promptbundle/raw-html/full-process-html/no-compatibility/export/UI acceptance, Amazon smoke, and Facebook mining acceptance passed.\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await main();
}
