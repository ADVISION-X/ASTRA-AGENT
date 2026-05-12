// Runtime Logging — run inspector and print findings.
// Output prefix: [RUNTIME-LOG-SPINE][PASS] or [RUNTIME-LOG-SPINE][FAIL].
// No generated JSON on PASS. Every FAIL includes checkId:question:detail.

import { runRuntimeLoggingInspector } from "./inspector.js";

const result = runRuntimeLoggingInspector();
const fails = result.checks.filter((c) => c.status === "FAIL");

if (result.pass) {
  process.stdout.write(
    `\n[RUNTIME-LOG-SPINE][PASS] checks=${result.checks.length} hardFails=0 aiFourPiece=present consoleScatter=0\n\n`,
  );
} else {
  process.stdout.write(`\n[RUNTIME-LOG-SPINE][FAIL] hardFails=${result.hardFails}\n\n`);
  for (const f of fails) {
    process.stdout.write(`  checkId: ${f.checkId}\n`);
    process.stdout.write(`  question: ${f.question}\n`);
    process.stdout.write(`  detail: ${f.detail}\n`);
    process.stdout.write(`  fixDirection: See module-RuntimeLogSpine.instructions.md\n\n`);
  }
  process.exit(1);
}
