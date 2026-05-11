// Visual Mission Runtime — run inspector and print results.

import { runVisualMissionRuntimeInspector } from "./inspector.js";

process.stdout.write("\n[VISUAL-MISSION-RUNTIME] Running runtime governance inspection (Break-2.x fixes)...\n\n");

const result = runVisualMissionRuntimeInspector();

for (const check of result.checks) {
  const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "⚠" : "✗";
  process.stdout.write(`  [${check.checkId}] ${icon} ${check.status} — ${check.question}\n`);
  if (check.status !== "PASS") {
    process.stdout.write(`          ${check.detail}\n`);
  }
}

process.stdout.write(`\n[VISUAL-MISSION-RUNTIME] Overall: ${result.overallStatus}\n\n`);

if (result.overallStatus === "FAIL") {
  process.exit(1);
}
