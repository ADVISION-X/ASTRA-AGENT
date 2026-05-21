import { runAiInputGatewayInspector } from "./inspector.js";

const result = await runAiInputGatewayInspector({ repoRoot: process.cwd() });

if (result.passed) {
  process.stdout.write("[AI-INPUT-GATEWAY][PASS] findings=0\n");
  process.exit(0);
}

process.stdout.write(`[AI-INPUT-GATEWAY][FAIL] findings=${result.violationCount}\n`);
for (const finding of result.findings) {
  process.stdout.write(`${finding.file}:${finding.line} ${finding.lawId} ${finding.message}\n`);
  if (finding.hint) process.stdout.write(`  fix: ${finding.hint}\n`);
}
process.exit(1);
