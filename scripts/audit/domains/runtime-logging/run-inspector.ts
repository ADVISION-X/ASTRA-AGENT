// Runtime Logging — run inspector and print findings.
// Output: [RUNTIME-LOG-SPINE][PASS] or [RUNTIME-LOG-SPINE][FAIL] with fixable lines.
// No generated JSON artifacts. No inventory on PASS. No --self-proof complexity.

import { runRuntimeLoggingInspector } from "./inspector.js";

const result = runRuntimeLoggingInspector();
const fails = result.checks.filter((c) => c.status === "FAIL");
const warns = result.checks.filter((c) => c.status === "WARN");

if (result.overallStatus === "PASS") {
  const aiFourPiece = ["CHECK-07", "CHECK-08", "CHECK-09", "CHECK-10"].every(
    (id) => result.checks.find((c) => c.checkId === id)?.status === "PASS"
  );
  process.stdout.write(
    `\n[RUNTIME-LOG-SPINE][PASS] checks=${result.checks.length} fails=0 aiFourPiece=${aiFourPiece ? "present" : "MISSING"} consoleScatter=0\n\n`
  );
  for (const w of warns) {
    process.stdout.write(`  [WARN] ${w.checkId} — ${w.question}\n`);
    process.stdout.write(`         ${w.detail}\n`);
  }
} else {
  process.stdout.write("\n[RUNTIME-LOG-SPINE][FAIL]\n\n");
  for (const f of fails) {
    process.stdout.write(`  checkId: ${f.checkId}\n`);
    process.stdout.write(`  rule: ${f.question}\n`);
    process.stdout.write(`  reason: ${f.detail}\n`);
    process.stdout.write(`  fixDirection: See module-RuntimeLogSpine.instructions.md\n\n`);
  }
  process.exit(1);
}



