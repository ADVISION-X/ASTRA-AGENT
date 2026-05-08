import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import type { RunnerSummary } from "../../core/schema-runner.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, runWithStandaloneHeartbeat, writeDomainRunnerSummary } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";

const DIRECT_OWNER_AUDIT_ENV = "GRASSEYE_DIRECT_PAGE_STATE_OWNER_AUDIT";

const buildDirectRunnerSummary = (phase: string, result: Awaited<ReturnType<Awaited<ReturnType<typeof loadInspector>>>>): RunnerSummary => ({
  generatedAt: new Date().toISOString(),
  phase,
  passed: result.passed && !hasBlockingFindings(result.findings),
  totals: {
    inspectors: 1,
    passed: result.passed ? 1 : 0,
    failed: result.passed ? 0 : 1,
    blocking: hasBlockingFindings(result.findings) ? 1 : 0,
  },
  results: [result],
});

const main = async (): Promise<void> => {
  if (!process.argv.includes("--skip-build")) {
    process.stdout.write("[AUDIT] building artifacts...\n");
    await runWithStandaloneHeartbeat("build-audit-artifacts", buildAuditArtifacts());
  }
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector("scripts/audit/domains/page-state-capability/inspector.ts");
  process.env[DIRECT_OWNER_AUDIT_ENV] = "1";
  process.stdout.write("[AUDIT] starting page-state-capability...\n");
  const result = await runWithStandaloneHeartbeat("page-state-capability", inspector(context));
  await writeDomainRunnerSummary(result.capabilityDomain, buildDirectRunnerSummary(artifacts.auditPlan.phase, result));

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (!result.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};

void main();
