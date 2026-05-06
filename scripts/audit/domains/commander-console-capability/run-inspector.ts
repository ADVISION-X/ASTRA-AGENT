import { createInspectorContext, loadGeneratedArtifacts, loadInspector, runWithStandaloneHeartbeat } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";

const main = async (): Promise<void> => {
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector("scripts/audit/domains/commander-console-capability/inspector.ts");
  process.stdout.write("[AUDIT] starting commander-console-capability...\n");
  const result = await runWithStandaloneHeartbeat("commander-console-capability", inspector(context));

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (!result.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};

void main();