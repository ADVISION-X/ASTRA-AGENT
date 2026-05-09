import { runOwnerInspector } from "../../core/owner-audit-runner.js";
import { hasBlockingFindings } from "../../core/result.js";
import type { RunnerSummary } from "../../core/schema-runner.js";
import { writeDomainRunnerSummary } from "../../core/runtime.js";

const DIRECT_OWNER_AUDIT_ENV = "GRASSEYE_DIRECT_PAGE_STATE_OWNER_AUDIT";

const buildDirectRunnerSummary = (phase: string, result: Awaited<ReturnType<typeof runOwnerInspector>>["result"]): RunnerSummary => ({
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
  const previousDirectOwnerAudit = process.env[DIRECT_OWNER_AUDIT_ENV];
  process.env[DIRECT_OWNER_AUDIT_ENV] = "1";
  try {
    const outcome = await runOwnerInspector({
      capabilityDomain: "page-state-capability",
      inspectorEntry: "scripts/audit/domains/page-state-capability/inspector.ts",
    });
    await writeDomainRunnerSummary(outcome.result.capabilityDomain, buildDirectRunnerSummary(outcome.artifacts.auditPlan.phase, outcome.result));

    if (!outcome.result.passed || hasBlockingFindings(outcome.result.findings)) {
      process.exitCode = 1;
    }
  } finally {
    if (previousDirectOwnerAudit === undefined) {
      delete process.env[DIRECT_OWNER_AUDIT_ENV];
    } else {
      process.env[DIRECT_OWNER_AUDIT_ENV] = previousDirectOwnerAudit;
    }
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
