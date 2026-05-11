// ci:full entrypoint — currently delegates entirely to ci:simple (quality-kernel only).
// This file is kept for package.json script compatibility.
// Re-introduce owner-by-owner inspection after the simplified production system is stable.
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("../../", import.meta.url).pathname);

const main = (): void => {
  process.stdout.write("[CI:FULL] Delegating to quality kernel (ci:simple mode).\n");

  // Step 1: typecheck
  process.stdout.write("[CI:FULL] Step 1/2: typecheck\n");
  const tc = spawnSync("npm", ["run", "typecheck"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
  if (tc.status !== 0) {
    process.stdout.write("[CI:FULL] FAIL — typecheck failed.\n");
    process.exit(1);
  }

  // Step 2: quality-kernel
  process.stdout.write("[CI:FULL] Step 2/2: quality-kernel\n");
  const qk = spawnSync("node", ["--import", "tsx", "scripts/audit/domains/quality-kernel/run-inspector.ts"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
  if (qk.status !== 0) {
    process.stdout.write("[CI:FULL] FAIL — quality kernel failed.\n");
    process.exit(1);
  }

  process.stdout.write("[CI:FULL] PASS — all steps passed.\n");
  process.exit(0);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
