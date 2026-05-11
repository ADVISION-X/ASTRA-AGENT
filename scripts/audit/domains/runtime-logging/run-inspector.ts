// Runtime Logging — run inspector and print results.

import { runRuntimeLoggingInspector } from "./inspector.js";

process.stdout.write("\n[RUNTIME-LOGGING] Running Runtime Log Spine governance inspection...\n\n");

const result = runRuntimeLoggingInspector();

for (const check of result.checks) {
  const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "⚠" : "✗";
  process.stdout.write(`  [${check.checkId}] ${icon} ${check.status} — ${check.question}\n`);
  if (check.status !== "PASS") {
    process.stdout.write(`          ${check.detail}\n`);
  }
}

process.stdout.write(`\n[RUNTIME-LOGGING] Overall: ${result.overallStatus}\n\n`);

if (result.overallStatus === "FAIL") {
  process.exit(1);
}
