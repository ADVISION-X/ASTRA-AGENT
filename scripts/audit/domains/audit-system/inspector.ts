import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { runAuditGovernanceChecks } from "./components/run-audit-governance-checks.js";
import { runAuditRedLineChecks } from "./components/run-audit-red-line-checks.js";

export const inspectAuditSystem = async (context: InspectorContext) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "audit-system",
    inspectorId: "audit-system-owner",
    inspectorEntry: "scripts/audit/domains/audit-system/inspector.ts",
  });

  const [governanceParts, redLineParts] = await Promise.all([
    runAuditGovernanceChecks(context),
    runAuditRedLineChecks(context),
  ]);
  const parts = [...governanceParts, ...redLineParts];

  const findings = [...base.findings, ...parts.flatMap((part) => part.findings)];
  const phases = [...base.phases, ...parts.flatMap((part) => part.phases)];

  return finalizeInspectorResult({
    inspector: "GrassEye Audit System Owner Inspector",
    inspectorId: "audit-system-owner",
    capabilityDomain: "audit-system",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "audit main chain is generated, routed, owner-boundary clean, and purity red lines are enforced"
        : "audit main chain has blocking law, manifest, runner, or purity-red-line defects",
  });
};
