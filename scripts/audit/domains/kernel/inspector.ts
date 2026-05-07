import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { runKernelBoundaryPhaseSuite } from "./kernel-boundary-phase-suite.js";
import { runKernelGovernancePhaseSuite } from "./kernel-governance-phase-suite.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_KERNEL_NEGATIVE_PROOF";

export async function kernelInspector(_context: InspectorContext) {
  const base = await runDomainOwnerInspection(_context, {
    capabilityDomain: "kernel",
    inspectorId: "kernel-owner",
    inspectorEntry: "scripts/audit/domains/kernel/inspector.ts",
  });
  const governance = await runKernelGovernancePhaseSuite();
  const boundaries = await runKernelBoundaryPhaseSuite(process.env[SKIP_NEGATIVE_PROOF_ENV] === "1");
  const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
      findings: [],
      phase: createPhase(
        "negative-proof-harness",
        "PASS",
        true,
        "Kernel negative-proof harness skipped for nested inspector execution.",
      ),
    }
    : await runNegativeProofHarness();

  const findings = [
    ...base.findings,
    ...governance.findings,
    ...boundaries.findings,
    ...negativeProof.findings,
  ];
  const phases = [
    ...base.phases,
    ...governance.phases,
    ...boundaries.phases,
    negativeProof.phase,
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Kernel Routing Inspector",
    inspectorId: "kernel-owner",
    capabilityDomain: "kernel",
    findings,
    phases,
    summary: findings.length === 0
      ? "kernel independently enforces top-level owners, child ownership, and prompt-contract routing boundaries"
      : "kernel routing owner still has law, script, or source drift",
  });
}
