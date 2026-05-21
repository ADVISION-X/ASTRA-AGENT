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

const main = async (): Promise<void> => {
  const steps: StepResult[] = [];
  buildAuditArtifacts();
  steps.push({ name: "build-audit-artifacts", status: "PASS" });

  const planRun = await runGeneratedPlan();
  steps.push({
    name: "run-generated-plan",
    status: planRun.hasFailures ? "FAIL" : "PASS",
    error: planRun.hasFailures ? "One or more audit domains reported findings." : undefined,
  });

  steps.push(await runCommand("typecheck", ["npm", "run", "typecheck"]));
  steps.push(await runCommand("amazon-invoice-upload-smoke", ["npm", "run", "acceptance:amazon-invoice-upload-smoke"]));

  const hasFailures = planRun.hasFailures || steps.some((step) => step.status === "FAIL");
  writeSummary({
    status: hasFailures ? "FAIL" : "PASS",
    steps,
    domains: planRun.domainReports,
  });

  if (hasFailures) {
    throw new Error("ci:full failed");
  }
  process.stdout.write("[CI-FULL] PASS — audit plan, typecheck, and Amazon smoke passed.\n");
};

await main();
