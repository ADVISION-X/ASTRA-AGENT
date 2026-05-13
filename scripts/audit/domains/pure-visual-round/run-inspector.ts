import { runPureVisualRoundInspector } from "./inspector.js";

const result = runPureVisualRoundInspector();
const fails = result.checks.filter((check) => check.status === "FAIL");

if (result.pass) {
  process.stdout.write(`\n[PURE-VISUAL-ROUND][PASS] checks=${result.checks.length} hardFails=0\n\n`);
} else {
  process.stdout.write(`\n[PURE-VISUAL-ROUND][FAIL] hardFails=${result.hardFails}\n\n`);
  for (const fail of fails) {
    process.stdout.write(`  checkId: ${fail.checkId}\n`);
    process.stdout.write(`  question: ${fail.question}\n`);
    process.stdout.write(`  detail: ${fail.detail}\n\n`);
  }
  process.exit(1);
}
