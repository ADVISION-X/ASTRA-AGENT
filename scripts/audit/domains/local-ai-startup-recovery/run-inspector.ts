/**
 * Local AI Startup Recovery — run inspector and print structured results.
 *
 * Exit 0 = PASS, Exit 1 = FAIL.
 */

import { runLocalAiStartupRecoveryInspector } from "./inspector.js";

process.stdout.write("\n[LOCAL-AI-STARTUP-RECOVERY] Running local AI startup recovery governance inspection...\n\n");

const result = runLocalAiStartupRecoveryInspector();

for (const check of result.checks) {
  const icon = check.status === "PASS" ? "✓" : "✗";
  process.stdout.write(`  [${check.checkId}] ${icon} ${check.status} — ${check.question}\n`);
  if (check.status === "FAIL") {
    process.stdout.write(`         DETAIL: ${check.detail}\n`);
  }
}

process.stdout.write(`\n[LOCAL-AI-STARTUP-RECOVERY] Overall: ${result.overallStatus}\n\n`);

if (result.overallStatus === "FAIL") {
  process.exit(1);
}
