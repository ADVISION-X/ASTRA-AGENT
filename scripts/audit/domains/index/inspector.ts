import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { indexInspectionConstants } from "./inspection-constants.js";
import { buildIndexInspectionSummary, collectIndexInspectionWithoutNegativeProof } from "./inspection-parts.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";

const { SKIP_NEGATIVE_PROOF_ENV } = indexInspectionConstants;

export async function indexInspector(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "index",
    inspectorId: "index-owner",
    inspectorEntry: "scripts/audit/domains/index/inspector.ts",
  });
  const inspection = await collectIndexInspectionWithoutNegativeProof(context);
  const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Index negative-proof harness was skipped for nested inspector execution.",
        ),
      }
    : await runNegativeProofHarness();

  const findings = [
    ...base.findings,
    ...inspection.findings,
    ...negativeProof.findings,
  ];
  const phases = [
    ...base.phases,
    ...inspection.phases,
    negativeProof.phase,
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Index Routing Inspector",
    inspectorId: "index-owner",
    capabilityDomain: "index",
    findings,
    phases,
    summary: buildIndexInspectionSummary(findings.length),
  });
}