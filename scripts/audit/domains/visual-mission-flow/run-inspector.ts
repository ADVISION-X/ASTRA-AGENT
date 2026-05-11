// Visual Mission Flow — run inspector and print results.

import { runVisualMissionFlowInspector } from "./inspector.js";

process.stdout.write("\n[VISUAL-MISSION-FLOW] Running mission flow governance inspection...\n\n");

const result = runVisualMissionFlowInspector();

for (const check of result.checks) {
  const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "⚠" : "✗";
  process.stdout.write(`  [${check.checkId}] ${icon} ${check.status} — ${check.question}\n`);
  if (check.status !== "PASS") {
    process.stdout.write(`          ${check.detail}\n`);
  }
}

process.stdout.write(`\n[VISUAL-MISSION-FLOW] Overall: ${result.overallStatus}\n\n`);

if (result.overallStatus === "FAIL") {
  process.exit(1);
}
