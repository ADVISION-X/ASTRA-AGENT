import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";
import { inspectAuditCoverageGovernance } from "./inspector.js";

const exitNow = (code: number): never => {
  process.exit(code);
};

const main = async (): Promise<void> => {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const result = await inspectAuditCoverageGovernance(context);

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const phase of result.phases) {
    process.stdout.write(`[${phase.classification}] ${phase.name}: ${phase.summary}\n`);
  }
  for (const finding of result.findings) {
    process.stderr.write(`- ${finding.severity.toUpperCase()} ${finding.lawId} ${finding.file}:${finding.line} ${finding.message}\n`);
    if (finding.detail) {
      process.stderr.write(`${finding.detail}\n`);
    }
  }

  exitNow(hasBlockingFindings(result.findings) ? 1 : 0);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[AUDIT-COVERAGE-GOVERNANCE ERROR] ${message}\n`);
  exitNow(1);
});
