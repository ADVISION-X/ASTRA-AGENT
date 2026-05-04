import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";

import { inspectVisualTargetCapability } from "./inspector.js";

const main = async (): Promise<void> => {
  if (!process.argv.includes("--skip-build")) {
    await buildAuditArtifacts();
  }
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const result = await inspectVisualTargetCapability(context);

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (!result.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};

void main();
