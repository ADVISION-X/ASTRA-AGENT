import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { hasBlockingFindings } from "../../core/result.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-user-love/inspector.ts";

async function main(): Promise<void> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const phase of result.phases) {
    process.stdout.write(`  - [${phase.classification}] ${phase.name}: ${phase.summary}\n`);
  }
  for (const finding of result.findings) {
    process.stdout.write(`  * ${finding.severity.toUpperCase()} ${finding.file}: ${finding.message}${finding.detail ? ` (${finding.detail})` : ""}\n`);
  }

  if (hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
}

void main();