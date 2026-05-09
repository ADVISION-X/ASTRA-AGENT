import { runOwnerInspector } from "../../core/owner-audit-runner.js";

const main = async (): Promise<void> => {
  const outcome = await runOwnerInspector({
    capabilityDomain: "audit-system",
    inspectorEntry: "scripts/audit/domains/audit-system/inspector.ts",
    skipNegativeProofEnv: "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF",
  });

  process.stdout.write(JSON.stringify({ auditConflicts: outcome.artifacts.auditConflicts.conflicts, result: outcome.result }, null, 2));
  if (outcome.artifacts.auditConflicts.conflicts.length > 0 || !outcome.result.passed) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});