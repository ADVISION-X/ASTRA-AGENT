import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { runKernelBoundaryPhaseSuite } from "./kernel-boundary-phase-suite.js";
import { runKernelGovernancePhaseSuite } from "./kernel-governance-phase-suite.js";

export async function kernelInspector(_context: InspectorContext) {
  const base = await runDomainOwnerInspection(_context, {
    capabilityDomain: "kernel",
    inspectorId: "kernel-owner",
    inspectorEntry: "scripts/audit/domains/kernel/inspector.ts",
  });
  const governance = await runKernelGovernancePhaseSuite();
  const boundaries = await runKernelBoundaryPhaseSuite();

  const findings = [
    ...base.findings,
    ...governance.findings,
    ...boundaries.findings,
  ];
  const phases = [
    ...base.phases,
    ...governance.phases,
    ...boundaries.phases,
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
