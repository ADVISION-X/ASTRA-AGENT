// ci:full entrypoint — the single authoritative CI gate.
// Runs: typecheck → audit:code-purity → audit:runtime-logging → audit:quality-kernel → dom-automation owner
// package.json ci:full must delegate here. Do not maintain a second CI chain.
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const step = (label: string, args: string[]): void => {
  process.stdout.write(`[CI:FULL] ${label}\n`);
  const r = spawnSync("npm", ["run", ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    process.stdout.write(`[CI:FULL] FAIL — ${label} failed.\n`);
    process.exit(1);
  }
};

const commandStep = (label: string, command: string, args: string[]): void => {
  process.stdout.write(`[CI:FULL] ${label}\n`);
  const r = spawnSync(command, args, {
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
  step("Step 1/5: typecheck", ["typecheck"]);
  step("Step 2/5: audit:code-purity", ["audit:code-purity"]);
  step("Step 3/5: audit:runtime-logging", ["audit:runtime-logging"]);
  step("Step 4/5: audit:quality-kernel", ["audit:quality-kernel"]);
  commandStep("Step 5/5: dom-automation owner", "node", ["--import", "tsx", "scripts/audit/domains/dom-automation/run-inspector.ts"]);
  process.stdout.write("[CI:FULL] PASS — all steps passed.\n");
  process.exit(0);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
