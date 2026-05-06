import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";

const main = async (): Promise<void> => {
  process.stdout.write("[audit:orchestration] Building audit artifacts...\n");
  await buildAuditArtifacts();
  process.stdout.write("[audit:orchestration] Artifacts ready. Loading inspector...\n");
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector("scripts/audit/domains/orchestration-capability/inspector.ts");
  process.stdout.write("[audit:orchestration] Running orchestration capability inspector...\n");
  const result = await inspector(context);

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (!result.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};

void main();