import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runAuditGovernanceChecks } from "./components/run-audit-governance-checks.js";
import { runAuditRedLineChecks } from "./components/run-audit-red-line-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF";

const createSkippedNegativeProofResult = () => {
  return {
    findings: [],
    phase: {
      name: "negative-proof-harness",
      classification: "PASS" as const,
      passed: true,
      summary: "Audit-system negative-proof harness was skipped for nested inspector execution.",
    },
  };
};

const runAuditSystemParts = (context: InspectorContext) => {
  return (async () => {
    const governanceParts = await runAuditGovernanceChecks(context);
    const redLineParts = await runAuditRedLineChecks(context);
    const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
      ? createSkippedNegativeProofResult()
      : await runNegativeProofHarness();
    return [governanceParts, redLineParts, negativeProof] as const;
  })();
};

const collectAuditSystemFindings = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  governanceParts: Awaited<ReturnType<typeof runAuditGovernanceChecks>>,
  redLineParts: Awaited<ReturnType<typeof runAuditRedLineChecks>>,
  negativeProof: Awaited<ReturnType<typeof runNegativeProofHarness>>,
) => {
  return [
    ...base.findings,
    ...governanceParts.flatMap((part) => part.findings),
    ...redLineParts.flatMap((part) => part.findings),
    ...negativeProof.findings,
  ];
};

const collectAuditSystemPhases = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  governanceParts: Awaited<ReturnType<typeof runAuditGovernanceChecks>>,
  redLineParts: Awaited<ReturnType<typeof runAuditRedLineChecks>>,
  negativeProof: Awaited<ReturnType<typeof runNegativeProofHarness>>,
) => {
  return [
    ...base.phases,
    ...governanceParts.flatMap((part) => part.phases),
    ...redLineParts.flatMap((part) => part.phases),
    negativeProof.phase,
  ];
};

export const inspectAuditSystem = async (context: InspectorContext) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "audit-system",
    inspectorId: "audit-system-owner",
    inspectorEntry: "scripts/audit/domains/audit-system/inspector.ts",
  });
  const [governanceParts, redLineParts, negativeProof] = await runAuditSystemParts(context);
  const findings = collectAuditSystemFindings(base, governanceParts, redLineParts, negativeProof);
  const phases = collectAuditSystemPhases(base, governanceParts, redLineParts, negativeProof);

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
