import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, runWithStandaloneHeartbeat } from "../../core/runtime.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/audit-system/inspector.ts";

const main = async (): Promise<void> => {
  if (!process.argv.includes("--skip-build")) {
    process.stdout.write("[AUDIT] building artifacts...\n");
    await runWithStandaloneHeartbeat("build-audit-artifacts", buildAuditArtifacts());
  }

  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  process.stdout.write("[AUDIT] starting audit-system...\n");
  const result = await runWithStandaloneHeartbeat("audit-system", inspector(context));

  process.stdout.write(JSON.stringify({ auditConflicts: artifacts.auditConflicts.conflicts, result }, null, 2));
  if (artifacts.auditConflicts.conflicts.length > 0 || !result.passed) {
    process.exitCode = 1;
  }
};

void main();