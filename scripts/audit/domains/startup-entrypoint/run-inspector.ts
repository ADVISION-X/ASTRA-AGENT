import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, runWithStandaloneHeartbeat } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";

const main = async (): Promise<void> => {
  process.stdout.write("[AUDIT] building artifacts...\n");
  await runWithStandaloneHeartbeat("build-audit-artifacts", buildAuditArtifacts());
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector("scripts/audit/domains/startup-entrypoint/inspector.ts");
  process.stdout.write("[AUDIT] starting startup-entrypoint...\n");
  const result = await runWithStandaloneHeartbeat("startup-entrypoint", inspector(context));

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (!result.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};

void main();