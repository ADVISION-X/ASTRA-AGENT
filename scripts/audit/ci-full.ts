import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import { runGeneratedPlan } from "./core/run-generated-plan.js";
import { generatedDir, repoRoot } from "./shared/paths.js";

export type StepResult = {
  command: string;
  durationMs: number;
  endedAt: string;
  name: string;
  startedAt: string;
  status: "PASS" | "FAIL";
  error?: string | undefined;
};

type CommandSpec = {
  command: readonly [string, ...string[]];
  name: string;
};

type PlanRunResult = Awaited<ReturnType<typeof runGeneratedPlan>>;

export const ciFullSummaryPath = resolve(generatedDir, "ci-full-summary.generated.json");

const ciCommands: readonly CommandSpec[] = [
  { name: "typecheck", command: ["npm", "run", "typecheck"] },
  { name: "code-purity-zombie-deep", command: ["npm", "run", "acceptance:code-purity-zombie-deep"] },
  { name: "audit-truth-coverage", command: ["npm", "run", "acceptance:audit-truth-coverage"] },
  { name: "ci-summary-truth", command: ["npm", "run", "acceptance:ci-summary-truth"] },
  { name: "runtime-truth-completed-evidence", command: ["npm", "run", "acceptance:runtime-truth-completed-evidence"] },
  { name: "runtime-log-spine", command: ["npm", "run", "acceptance:runtime-log-spine"] },
  { name: "deep-research-decomposition-prompt", command: ["npm", "run", "acceptance:deep-research-decomposition-prompt"] },
  { name: "deep-research-analysis-smoke", command: ["npm", "run", "acceptance:deep-research-analysis-smoke"] },
  { name: "deep-research-ai-html-report", command: ["npm", "run", "acceptance:deep-research-ai-html-report"] },
  { name: "deep-research-html-prompt-boundary", command: ["npm", "run", "acceptance:deep-research-html-prompt-boundary"] },
  { name: "deep-research-html-artifact-persist", command: ["npm", "run", "acceptance:deep-research-html-artifact-persist"] },
  { name: "deep-research-ppt-optional-demotion", command: ["npm", "run", "acceptance:deep-research-ppt-optional-demotion"] },
  { name: "deep-research-report-export", command: ["npm", "run", "acceptance:deep-research-report-export"] },
  { name: "deep-research-report-reader-ui", command: ["npm", "run", "acceptance:deep-research-report-reader-ui"] },
  { name: "deep-research-app-ui", command: ["npm", "run", "acceptance:deep-research-app-ui"] },
  { name: "amazon-invoice-upload-smoke", command: ["npm", "run", "acceptance:amazon-invoice-upload-smoke"] },
  { name: "facebook-product-video-mining", command: ["npm", "run", "acceptance:facebook-product-video-mining"] },
];

const createStepResult = (input: {
  command: string;
  error?: string | undefined;
  name: string;
  startedAtMs: number;
  status: "PASS" | "FAIL";
}): StepResult => {
  const endedAtMs = Date.now();
  return {
    command: input.command,
    durationMs: Math.max(0, endedAtMs - input.startedAtMs),
    endedAt: new Date(endedAtMs).toISOString(),
    name: input.name,
    startedAt: new Date(input.startedAtMs).toISOString(),
    status: input.status,
    error: input.error,
  };
};

const formatCommand = (command: readonly string[]): string => command.join(" ");

const runCommand = async (
  name: string,
  command: readonly [string, ...string[]],
): Promise<StepResult> => {
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
      command: formatCommand(command),
      name,
      startedAtMs,
      status: "PASS",
    });
  }
  return createStepResult({
    command: formatCommand(command),
    error: `${name} failed with exit code ${exitCode}`,
    name,
    startedAtMs,
    status: "FAIL",
  });
};

export const writeCiFullSummary = (summary: {
  status: "PASS" | "FAIL";
  steps: readonly StepResult[];
  domains: readonly {
    capabilityDomain: string;
    executionGroup: string;
    status: "PASS" | "FAIL";
    findingCount: number;
    reportPath: string;
  }[];
}): void => {
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(
    ciFullSummaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: summary.status,
        steps: summary.steps,
        domains: summary.domains,
      },
      null,
      2,
    )}\n`,
  );
};

const runAuditBuildStep = (): StepResult => {
  const startedAtMs = Date.now();
  buildAuditArtifacts();
  return createStepResult({
    command: "internal:buildAuditArtifacts()",
    name: "build-audit-artifacts",
    startedAtMs,
    status: "PASS",
  });
};

const runGeneratedPlanStep = async (): Promise<{ planRun: PlanRunResult; step: StepResult }> => {
  const startedAtMs = Date.now();
  const planRun = await runGeneratedPlan();
  return {
    planRun,
    step: createStepResult({
      command: "internal:runGeneratedPlan()",
      name: "run-generated-plan",
      error: planRun.hasFailures ? "One or more audit domains reported findings." : undefined,
      startedAtMs,
      status: planRun.hasFailures ? "FAIL" : "PASS",
    }),
  };
};

const runCiCommands = async (): Promise<StepResult[]> => {
  const stepResults: StepResult[] = [];
  for (const step of ciCommands) {
    stepResults.push(await runCommand(step.name, step.command));
  }
  return stepResults;
};

const collectCiSteps = async (): Promise<{ planRun: PlanRunResult; steps: StepResult[] }> => {
  const steps: StepResult[] = [];
  steps.push(runAuditBuildStep());

  const generatedPlanStep = await runGeneratedPlanStep();
  steps.push(generatedPlanStep.step);
  steps.push(...await runCiCommands());

  return {
    planRun: generatedPlanStep.planRun,
    steps,
  };
};

const main = async (): Promise<void> => {
  const { planRun, steps } = await collectCiSteps();

  const hasFailures = planRun.hasFailures || steps.some((step) => step.status === "FAIL");
  writeCiFullSummary({
    status: hasFailures ? "FAIL" : "PASS",
    steps,
    domains: planRun.domainReports,
  });

  if (hasFailures) {
    throw new Error("ci:full failed");
  }
  process.stdout.write("[CI-FULL] PASS — audit plan, typecheck, runtime log acceptance, Deep Research smoke, HTML report flow/prompt/persist/PPT-optional acceptance, Deep Research report export acceptance, Amazon smoke, and Facebook mining acceptance passed.\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await main();
}
