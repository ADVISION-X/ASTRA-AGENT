import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { hasBlockingFindings } from "../../core/result.js";
import { createInspectorContext, loadGeneratedArtifacts } from "../../core/runtime.js";
import { inspectCodePurity } from "./components/inspect-code-purity.js";

const main = async (): Promise<void> => {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const result = await inspectCodePurity(context);
  const blocking = hasBlockingFindings(result.findings);

  process.stdout.write(`[${blocking ? "CODE VIOLATION" : "PASS"}] code-purity: ${result.findings.length} finding(s)\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.lawId} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (blocking) {
    process.exitCode = 1;
  }
};

void main();
