import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import type { RunnerSummary } from "../../core/schema-runner.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { hasBlockingFindings } from "../../core/result.js";
import { writeRunnerSummary } from "../../core/runtime.js";

const DIRECT_OWNER_AUDIT_ENV = "GRASSEYE_DIRECT_PAGE_STATE_OWNER_AUDIT";

const buildDirectRunnerSummary = (phase: string, result: Awaited<ReturnType<Awaited<ReturnType<typeof loadInspector>>>>): RunnerSummary => ({
  generatedAt: new Date().toISOString(),
  phase,
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
    await buildAuditArtifacts();
  }
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector("scripts/audit/domains/page-state-capability/inspector.ts");
  process.env[DIRECT_OWNER_AUDIT_ENV] = "1";
  const result = await inspector(context);
  await writeRunnerSummary(buildDirectRunnerSummary(artifacts.auditPlan.phase, result));

  process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }

  if (!result.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};

void main();
