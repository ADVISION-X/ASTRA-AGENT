/**
 * run-inspector.ts — Open capability inspector runner.
 *
 * Usage: npx tsx scripts/audit/domains/open-capability/run-inspector.ts
 */

import { runOpenInspector } from "./inspector.js";

const report = runOpenInspector();

console.log(`\n${"=".repeat(60)}`);
console.log(`Open Capability Inspector — ${report.overallStatus}`);
console.log("=".repeat(60));

for (const check of report.checks) {
  const icon = check.pass ? "✓" : "✗";
  console.log(`  ${icon} ${check.id}: ${check.question}`);
  console.log(`     ${check.detail}`);
}

console.log("=".repeat(60));
console.log(`Overall: ${report.overallStatus}\n`);

if (report.overallStatus === "FAIL") {
  process.exit(1);
}
