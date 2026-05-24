import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import { runGeneratedPlan } from "./core/run-generated-plan.js";
import { generatedDir, repoRoot } from "./shared/paths.js";

type StepResult = {
  name: string;
  status: "PASS" | "FAIL";
  error?: string | undefined;
};

type CommandSpec = {
  command: readonly [string, ...string[]];
  name: string;
};

type PlanRunResult = Awaited<ReturnType<typeof runGeneratedPlan>>;

const ciCommands: readonly CommandSpec[] = [
  { name: "typecheck", command: ["npm", "run", "typecheck"] },
  { name: "code-purity-zombie-deep", command: ["npm", "run", "acceptance:code-purity-zombie-deep"] },
  { name: "audit-truth-coverage", command: ["npm", "run", "acceptance:audit-truth-coverage"] },
  { name: "runtime-log-spine", command: ["npm", "run", "acceptance:runtime-log-spine"] },
  { name: "deep-research-decomposition-prompt", command: ["npm", "run", "acceptance:deep-research-decomposition-prompt"] },
  { name: "deep-research-analysis-smoke", command: ["npm", "run", "acceptance:deep-research-analysis-smoke"] },
  { name: "deep-research-report-export", command: ["npm", "run", "acceptance:deep-research-report-export"] },
  { name: "deep-research-report-reader-ui", command: ["npm", "run", "acceptance:deep-research-report-reader-ui"] },
  { name: "deep-research-app-ui", command: ["npm", "run", "acceptance:deep-research-app-ui"] },
  { name: "amazon-invoice-upload-smoke", command: ["npm", "run", "acceptance:amazon-invoice-upload-smoke"] },
  { name: "facebook-product-video-mining", command: ["npm", "run", "acceptance:facebook-product-video-mining"] },
];

const runCommand = async (
  name: string,
  command: readonly [string, ...string[]],
): Promise<StepResult> => {
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
    return { name, status: "PASS" };
  }
  return {
    name,
    status: "FAIL",
    error: `${name} failed with exit code ${exitCode}`,
  };
};

const writeSummary = (summary: {
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
    resolve(generatedDir, "ci-full-summary.generated.json"),
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

const runGeneratedPlanStep = async (): Promise<{ planRun: PlanRunResult; step: StepResult }> => {
  const planRun = await runGeneratedPlan();
  return {
    planRun,
    step: {
      name: "run-generated-plan",
      status: planRun.hasFailures ? "FAIL" : "PASS",
      error: planRun.hasFailures ? "One or more audit domains reported findings." : undefined,
    },
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
  buildAuditArtifacts();
  steps.push({ name: "build-audit-artifacts", status: "PASS" });

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
  writeSummary({
    status: hasFailures ? "FAIL" : "PASS",
    steps,
    domains: planRun.domainReports,
  });

  if (hasFailures) {
    throw new Error("ci:full failed");
  }
  process.stdout.write("[CI-FULL] PASS — audit plan, typecheck, runtime log acceptance, Deep Research smoke, Deep Research report export acceptance, Amazon smoke, and Facebook mining acceptance passed.\n");
};

await main();
