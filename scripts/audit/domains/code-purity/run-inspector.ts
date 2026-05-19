// Code Purity — run inspector and print findings.
// Output prefix: [CODE-PURITY][PASS] or [CODE-PURITY][FAIL].
// No generated JSON on PASS. Every HARD finding includes file:line:rule:message.

import { runCodePurityInspector } from "./inspector.js";

const result = runCodePurityInspector();

const fixDirectionFor = (rule: string): string => {
  if (rule === "CP-FILE-001") return "Split the file by owner responsibility until it is under the hard line limit.";
  if (rule === "CP-AST-008") return "Split the function into parse, validate, decide, execute, buildResult, proof, or log helpers.";
  if (rule === "CP-AST-009") return "Reduce import/export surface or move symbols behind narrow public contracts.";
  if (rule === "CP-AST-013") return "Split oversized class/object construction into smaller named builders.";
  if (rule === "CP-AST-015") return "Delete the unused export or connect it through an active governed import.";
  if (rule === "CP-AST-016") return "Delete the dead file or connect it through an active governed import or entrypoint.";
  if (rule === "CP-AST-017") return "Regenerate through the governed generator path; do not hand-edit generated artifacts.";
  return "Remove or replace this pattern; no suppressions allowed.";
};

if (result.pass) {
  process.stdout.write(
    `\n[CODE-PURITY][PASS] hardFails=0 fileCountFails=0\n\n`,
  );
} else {
  process.stdout.write(
    `\n[CODE-PURITY][FAIL] hardFails=${result.hardFails} fileCountFails=${result.fileCountFails}\n\n`,
  );

  for (const f of result.findings) {
    process.stdout.write(`  file: ${f.file}:${f.line}\n`);
    process.stdout.write(`  rule: ${f.rule}\n`);
    process.stdout.write(`  violation: ${f.message}\n`);
    process.stdout.write(`  fixDirection: ${fixDirectionFor(f.rule)}\n\n`);
  }

  process.exit(1);
}
