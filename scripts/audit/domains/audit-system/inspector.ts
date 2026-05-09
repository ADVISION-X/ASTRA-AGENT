import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runAuditGovernanceChecks } from "./components/run-audit-governance-checks.js";
import { runAuditRedLineChecks } from "./components/run-audit-red-line-checks.js";

export const inspectAuditSystem = async (context: InspectorContext) => {
  const [governanceParts, redLineParts] = await Promise.all([
    runAuditGovernanceChecks(context),
    runAuditRedLineChecks(context),
  ]);
  const findings = [
    ...governanceParts.flatMap((part) => part.findings),
    ...redLineParts.flatMap((part) => part.findings),
  ];
  const phases = [
    ...governanceParts.flatMap((part) => part.phases),
    ...redLineParts.flatMap((part) => part.phases),
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Audit System Owner Inspector",
    inspectorId: "audit-system-owner",
    capabilityDomain: "audit-system",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "audit main chain generated artifacts, manifest mappings, and code-purity evidence are valid"
        : "audit main chain has blocking law, manifest, generated-artifact, or code-purity defects",
  });
};
