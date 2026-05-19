// ci:full entrypoint — the single authoritative CI gate.
// Runs: foundation guardrails, then every governed owner runner declared by owner manifests.
// package.json ci:full must delegate here. Do not maintain a second CI chain.
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCiFullSteps } from "./core/ci-full-plan.js";
import { pathFromRepoRoot } from "./core/paths.js";
import { writeGeneratedJson } from "./core/generated-artifact.js";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const DOM_AUTOMATION_RESULT_PATH = pathFromRepoRoot("scripts/audit/generated/dom-automation-binary-result.generated.json");

const readDomAutomationBinaryResult = (): { status: string; summary?: { passedLaws?: number; totalLaws?: number; passedClauses?: number; totalClauses?: number } } | null => {
  if (!existsSync(DOM_AUTOMATION_RESULT_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(DOM_AUTOMATION_RESULT_PATH, "utf8")) as { status: string; summary?: { passedLaws?: number; totalLaws?: number; passedClauses?: number; totalClauses?: number } };
};

const runStep = async (
  label: string,
  command: readonly [string, ...string[]],
  processed: number,
  total: number,
): Promise<number> => {
  process.stdout.write(`[CI-FULL][HEARTBEAT] step=${label} processed=${processed}/${total} status=running\n`);
  const [executable, ...args] = command;
  const child = spawn(executable, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
  const heartbeat = setInterval(() => {
    process.stdout.write(`[CI-FULL][HEARTBEAT] step=${label} processed=${processed}/${total} status=running\n`);
  }, 5_000);

  return await new Promise<number>((resolvePromise, rejectPromise) => {
    child.once("error", (error) => {
      clearInterval(heartbeat);
      rejectPromise(error);
    });
    child.once("exit", (code) => {
      clearInterval(heartbeat);
      resolvePromise(code ?? 1);
    });
  });
};

const main = async (): Promise<void> => {
  const steps = buildCiFullSteps();
  const stepResults: Array<{ name: string; status: "PASS" | "FAIL" }> = [];
  for (const [index, definition] of steps.entries()) {
    const label = `step-${index + 1}-${definition.name}`;
    const exitCode = await runStep(label, definition.command, index, steps.length);
    const status = exitCode === 0 ? "PASS" : "FAIL" as const;
    stepResults.push({ name: definition.name, status });
    process.stdout.write(`[CI-FULL][${definition.layer === "owner-layer" ? `OWNER-${status}` : `STEP-${status}`}] name=${definition.name}\n`);
    if (exitCode !== 0) {
      writeGeneratedJson("ci-full-summary.generated.json", {
        generatedAt: new Date().toISOString(),
        status: "FAIL",
        failedStep: definition.name,
        steps: stepResults,
      });
      process.stdout.write(`[CI-FULL] FAIL — ${definition.name} failed.\n`);
      process.exit(1);
    }
  }

  writeGeneratedJson("ci-full-summary.generated.json", {
    generatedAt: new Date().toISOString(),
    status: "PASS",
    steps: stepResults,
  });
  process.stdout.write("[CI-FULL] PASS — all steps passed.\n");
  process.exit(0);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
