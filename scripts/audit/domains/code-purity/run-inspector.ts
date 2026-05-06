import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { hasBlockingFindings } from "../../core/result.js";
import { createInspectorContext, loadGeneratedArtifacts, runWithStandaloneHeartbeat } from "../../core/runtime.js";
import { inspectCodePurity } from "./components/inspect-code-purity.js";

const main = async (): Promise<void> => {
  process.stdout.write("[AUDIT] building artifacts...\n");
  await runWithStandaloneHeartbeat("build-audit-artifacts", buildAuditArtifacts());
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  process.stdout.write("[AUDIT] starting code-purity...\n");
  const result = await runWithStandaloneHeartbeat("code-purity", inspectCodePurity(context));
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
