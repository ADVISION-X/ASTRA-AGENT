import { runAuditSystemInspector } from "./inspector.js";

const result = await runAuditSystemInspector({ repoRoot: process.cwd() });

if (result.passed) {
  process.stdout.write(`\n[AUDIT-SYSTEM][PASS] findings=0 phases=${result.phases.length} inspector=${result.inspectorId}\n\n`);
  process.exit(0);
}

process.stdout.write(`\n[AUDIT-SYSTEM][FAIL] findings=${result.violationCount}\n\n`);
for (const finding of result.findings) {
  process.stdout.write(`  file: ${finding.file}:${finding.line}\n`);
  process.stdout.write(`  lawId: ${finding.lawId}\n`);
  process.stdout.write(`  violation: ${finding.message}\n`);
  if (finding.hint) process.stdout.write(`  fixDirection: ${finding.hint}\n`);
  process.stdout.write("\n");
}
process.exit(1);