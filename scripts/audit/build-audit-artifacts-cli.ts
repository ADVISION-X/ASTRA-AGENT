import { fileURLToPath } from "node:url";

import { buildAuditArtifacts } from "./build-audit-artifacts.js";

const main = async (): Promise<void> => {
  const artifacts = await buildAuditArtifacts();
  for (const conflict of artifacts.auditConflicts.conflicts) {
    process.stderr.write(
      `[AUDIT-BUILD-CONFLICT] ${conflict.kind} ${conflict.capabilityDomain ?? "unknown-domain"} ${conflict.lawId ?? "no-law-id"}: ${conflict.message}\n`,
    );
  }
  process.stdout.write(
    `Generated ${artifacts.lawRegistry.laws.length} active laws, ${artifacts.enforcementMatrix.owners.length} owners, ${artifacts.auditPlan.owners.length} planned inspections, ${artifacts.auditConflicts.conflicts.length} conflicts.\n`,
  );
  if (artifacts.auditConflicts.conflicts.length > 0) {
    process.exit(1);
  }
  process.stdout.write("[AUDIT-BUILD PASS] generated artifacts with zero conflicts.\n");
  process.exit(0);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`[AUDIT-BUILD ERROR] ${message}\n`);
    process.exit(1);
  });
}
