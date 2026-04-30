import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/audit-system/inspector.ts";

const main = async (): Promise<void> => {
  if (!process.argv.includes("--skip-build")) {
    await buildAuditArtifacts();
  }

  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);

  process.stdout.write(JSON.stringify({ auditConflicts: artifacts.auditConflicts.conflicts, result }, null, 2));
  if (artifacts.auditConflicts.conflicts.length > 0 || !result.passed) {
    process.exitCode = 1;
  }
};

void main();