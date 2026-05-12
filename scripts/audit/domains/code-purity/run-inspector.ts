// Code Purity — run inspector and print findings.
// Output prefix: [CODE-PURITY][PASS] or [CODE-PURITY][FAIL].
// No generated JSON on PASS. Every HARD finding includes file:line:rule:message.

import { runCodePurityInspector } from "./inspector.js";

const result = runCodePurityInspector();

if (result.pass) {
  process.stdout.write(
    `\n[CODE-PURITY][PASS] findings=${result.findings.length} hardFails=0 retiredSurface=0 fileCountFails=0\n\n`,
  );
  for (const w of result.findings.filter((f) => f.severity === "WARN")) {
    process.stdout.write(`  [WARN] ${w.file}:${w.line} — ${w.rule}: ${w.message}\n`);
  }
} else {
  process.stdout.write(
    `\n[CODE-PURITY][FAIL] hardFails=${result.hardFails} retiredSurface=${result.findings.filter((f) => f.rule === "CP-AST-006" || f.rule === "CP-FILE-001").length} fileCountFails=${result.fileCountFails}\n\n`,
  );

  for (const f of result.findings.filter((fi) => fi.severity === "HARD")) {
    process.stdout.write(`  file: ${f.file}:${f.line}\n`);
    process.stdout.write(`  rule: ${f.rule}\n`);
    process.stdout.write(`  violation: ${f.message}\n`);
    process.stdout.write(`  fixDirection: Remove or replace this pattern — no suppressions allowed.\n\n`);
  }

  process.exit(1);
}
