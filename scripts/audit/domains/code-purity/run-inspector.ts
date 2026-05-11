// Code Purity — run inspector and print findings.
// Output: [CODE-PURITY][PASS] or [CODE-PURITY][FAIL] with fixable finding lines.
// No generated JSON artifacts. No inventory on PASS.

import { runCodePurityInspector } from "./inspector.js";

const result = runCodePurityInspector();

if (result.pass) {
  const total = result.purityFindings.length + result.retiredSurfaceFindings.length;
  process.stdout.write(
    `\n[CODE-PURITY][PASS] findings=${total} hardFails=0 retiredSurface=0 fileCountFails=0\n\n`
  );
  // Show warnings (non-blocking) if any
  for (const f of result.purityFindings) {
    if (f.severity === "WARN") {
      process.stdout.write(`  [WARN] ${f.file}:${f.line} — ${f.rule}\n`);
      process.stdout.write(`         fixDirection: ${f.fixDirection}\n`);
    }
  }
} else {
  process.stdout.write("\n[CODE-PURITY][FAIL]\n\n");

  // Hard purity failures
  for (const f of result.purityFindings.filter((p) => p.severity === "HARD")) {
    process.stdout.write(`  file: ${f.file}:${f.line}\n`);
    process.stdout.write(`  rule: ${f.rule}\n`);
    process.stdout.write(`  fixDirection: ${f.fixDirection}\n\n`);
  }

  // Retired surface
  for (const f of result.retiredSurfaceFindings) {
    process.stdout.write(`  file: ${f.file}:${f.line}\n`);
    process.stdout.write(`  rule: retired surface pattern found\n`);
    process.stdout.write(`  reason: "${f.pattern}" must not appear in active code\n`);
    process.stdout.write(`  fixDirection: Remove reference to retired system.\n\n`);
  }

  // File count failures
  for (const f of result.fileCountFindings.filter((fc) => fc.status !== "ok")) {
    if (f.status === "retired-exists") {
      process.stdout.write(`  file: ${f.module}/\n`);
      process.stdout.write(`  rule: retired capability root must not exist\n`);
      process.stdout.write(`  fixDirection: Delete ${f.module}/ — it is a retired system.\n\n`);
    } else {
      process.stdout.write(`  file: ${f.module}/\n`);
      process.stdout.write(`  rule: module file count exceeded (${f.actual} > ${f.limit})\n`);
      process.stdout.write(`  fixDirection: Split or consolidate files in ${f.module}/.\n\n`);
    }
  }

  process.exit(1);
}
