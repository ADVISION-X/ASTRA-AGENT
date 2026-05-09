import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { runAuditGovernanceChecks } from "./components/run-audit-governance-checks.js";
import { runAuditRedLineChecks } from "./components/run-audit-red-line-checks.js";

const runAuditSystemParts = (context: InspectorContext) => {
  return (async () => {
    const governanceParts = await runAuditGovernanceChecks(context);
    const redLineParts = await runAuditRedLineChecks(context);
    return [governanceParts, redLineParts] as const;
  })();
};

const collectAuditSystemFindings = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  governanceParts: Awaited<ReturnType<typeof runAuditGovernanceChecks>>,
  redLineParts: Awaited<ReturnType<typeof runAuditRedLineChecks>>,
) => {
  return [
    ...base.findings,
    ...governanceParts.flatMap((part) => part.findings),
    ...redLineParts.flatMap((part) => part.findings),
  ];
};

const collectAuditSystemPhases = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  governanceParts: Awaited<ReturnType<typeof runAuditGovernanceChecks>>,
  redLineParts: Awaited<ReturnType<typeof runAuditRedLineChecks>>,
) => {
  return [
    ...base.phases,
    ...governanceParts.flatMap((part) => part.phases),
    ...redLineParts.flatMap((part) => part.phases),
  ];
};

export const inspectAuditSystem = async (context: InspectorContext) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "audit-system",
    inspectorId: "audit-system-owner",
    inspectorEntry: "scripts/audit/domains/audit-system/inspector.ts",
  });
  const [governanceParts, redLineParts] = await runAuditSystemParts(context);
  const findings = collectAuditSystemFindings(base, governanceParts, redLineParts);
  const phases = collectAuditSystemPhases(base, governanceParts, redLineParts);

  return finalizeInspectorResult({
    inspector: "GrassEye Audit System Owner Inspector",
    inspectorId: "audit-system-owner",
    capabilityDomain: "audit-system",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "audit main chain is generated, routed, owner-boundary clean, and purity evidence is validated"
        : "audit main chain has blocking law, manifest, runner, or purity-red-line defects",
  });
};
