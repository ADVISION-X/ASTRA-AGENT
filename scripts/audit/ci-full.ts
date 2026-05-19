// ci:full entrypoint — the single authoritative CI gate.
// Runs: foundation guardrails, then every governed owner runner declared by owner manifests.
// package.json ci:full must delegate here. Do not maintain a second CI chain.
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { buildCiFullSteps } from "./core/ci-full-plan.js";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const step = (label: string, command: readonly [string, ...string[]]): void => {
  process.stdout.write(`[CI:FULL] ${label}\n`);
  const [executable, ...args] = command;
  const r = spawnSync(executable, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    process.stdout.write(`[CI:FULL] FAIL — ${label} failed.\n`);
    process.exit(1);
  }
};

const main = (): void => {
  const steps = buildCiFullSteps();
  steps.forEach((definition, index) => {
    step(`Step ${index + 1}/${steps.length}: ${definition.name}`, definition.command);
  });
  process.stdout.write("[CI:FULL] PASS — all steps passed.\n");
  process.exit(0);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
