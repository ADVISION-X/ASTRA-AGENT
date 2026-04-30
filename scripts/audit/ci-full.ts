import { spawnSync } from "node:child_process";

interface CiStep {
  label: string;
  args: string[];
}

const CI_STEP_TIMEOUT_MS = 120_000;

const steps: CiStep[] = [
  { label: "typecheck", args: ["run", "typecheck"] },
  { label: "audit build", args: ["run", "audit:build"] },
  { label: "audit", args: ["run", "audit"] },
];

const exitNow = (code: number): never => {
  process.exit(code);
};

for (const [index, step] of steps.entries()) {
  process.stdout.write(`[CI FULL] ${index + 1}/${steps.length} starting ${step.label}...\n`);

  const result = spawnSync("npm", step.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: CI_STEP_TIMEOUT_MS,
  });

  if (result.error) {
    process.stderr.write(`[CI FULL FAIL-FAST] ${step.label} could not start: ${result.error.message}\n`);
    exitNow(1);
  }

  if (result.status !== 0) {
    const status = result.status ?? 1;
    const timeoutDetail = result.signal === "SIGTERM" ? ` after ${CI_STEP_TIMEOUT_MS}ms` : "";
    process.stderr.write(`[CI FULL FAIL-FAST] stopped at ${step.label}${timeoutDetail} with exit code ${status}.\n`);
    exitNow(status);
  }

  process.stdout.write(`[CI FULL] ${step.label} passed.\n`);
}

process.stdout.write("[CI FULL PASS] typecheck, audit build, and audit all passed.\n");
exitNow(0);
