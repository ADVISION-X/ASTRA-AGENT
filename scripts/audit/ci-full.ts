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
  { name: "codex-entry-gate", command: ["npm", "run", "codex:entry-gate"] },
  { name: "typecheck", command: ["npm", "run", "typecheck"] },
  { name: "code-purity-zombie-deep", command: ["npm", "run", "acceptance:code-purity-zombie-deep"] },
  { name: "audit-truth-coverage", command: ["npm", "run", "acceptance:audit-truth-coverage"] },
  { name: "ci-summary-truth", command: ["npm", "run", "acceptance:ci-summary-truth"] },
  { name: "runtime-truth-completed-evidence", command: ["npm", "run", "acceptance:runtime-truth-completed-evidence"] },
  { name: "runtime-log-spine", command: ["npm", "run", "acceptance:runtime-log-spine"] },
  { name: "deep-research-analysis-smoke", command: ["npm", "run", "acceptance:deep-research-analysis-smoke"] },
  { name: "deep-research-promptbundle-sovereignty", command: ["npm", "run", "acceptance:deep-research-promptbundle-sovereignty"] },
  { name: "deep-research-per-subquestion-promptbundle", command: ["npm", "run", "acceptance:deep-research-per-subquestion-promptbundle"] },
  { name: "deep-research-single-chain", command: ["npm", "run", "acceptance:deep-research-single-chain"] },
  { name: "deep-research-full-case-file", command: ["npm", "run", "acceptance:deep-research-full-case-file"] },
  { name: "deep-research-runtime-shell-only", command: ["npm", "run", "acceptance:deep-research-runtime-shell-only"] },
  { name: "deep-research-raw-response-sovereignty", command: ["npm", "run", "acceptance:deep-research-raw-response-sovereignty"] },
  { name: "deep-research-format-shell-boundary", command: ["npm", "run", "acceptance:deep-research-format-shell-boundary"] },
  { name: "deep-research-final-adjudication-raw", command: ["npm", "run", "acceptance:deep-research-final-adjudication-raw"] },
  { name: "deep-research-no-system-confidence", command: ["npm", "run", "acceptance:deep-research-no-system-confidence"] },
  { name: "deep-research-promptbundle-field-consistency", command: ["npm", "run", "acceptance:deep-research-promptbundle-field-consistency"] },
  { name: "deep-research-html-uses-raw-final-answer", command: ["npm", "run", "acceptance:deep-research-html-uses-raw-final-answer"] },
  { name: "deep-research-final-adjudication-promptbundle-input", command: ["npm", "run", "acceptance:deep-research-final-adjudication-promptbundle-input"] },
  { name: "deep-research-html-promptbundle-input", command: ["npm", "run", "acceptance:deep-research-html-promptbundle-input"] },
  { name: "deep-research-html-report-only", command: ["npm", "run", "acceptance:deep-research-html-report-only"] },
  { name: "deep-research-subquestion-failure-stop", command: ["npm", "run", "acceptance:deep-research-subquestion-failure-stop"] },
  { name: "deep-research-report-export", command: ["npm", "run", "acceptance:deep-research-report-export"] },
  { name: "deep-research-no-compatibility-formats", command: ["npm", "run", "acceptance:deep-research-no-compatibility-formats"] },
  { name: "deep-research-app-ui", command: ["npm", "run", "acceptance:deep-research-app-ui"] },
  { name: "deep-research-case-reader-ui", command: ["npm", "run", "acceptance:deep-research-case-reader-ui"] },
  { name: "deep-research-promptbundle-visibility-ui", command: ["npm", "run", "acceptance:deep-research-promptbundle-visibility-ui"] },
  { name: "deep-research-clean-raw-index-ui", command: ["npm", "run", "acceptance:deep-research-clean-raw-index-ui"] },
  { name: "deep-research-html-delivery-status-ui", command: ["npm", "run", "acceptance:deep-research-html-delivery-status-ui"] },
  { name: "amazon-invoice-upload-smoke", command: ["npm", "run", "acceptance:amazon-invoice-upload-smoke"] },
  { name: "facebook-product-video-mining", command: ["npm", "run", "acceptance:facebook-product-video-mining"] },
  { name: "amazon-product-mining", command: ["npm", "run", "acceptance:amazon-product-mining"] },
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
  process.stdout.write("[CI-FULL] PASS — entry gate, audit plan, typecheck, runtime log acceptance, Deep Research smoke, single-chain/raw/full-case/format-shell/no-confidence/promptbundle/raw-html/no-compatibility/export/UI acceptance, Amazon smoke, and Facebook mining acceptance passed.\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await main();
}
