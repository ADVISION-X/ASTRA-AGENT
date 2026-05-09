import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { indexInspectionConstants } from "./inspection-constants.js";
import { buildIndexInspectionSummary, collectIndexInspection } from "./inspection-parts.js";

export async function indexInspector(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "index",
    inspectorId: "index-owner",
    inspectorEntry: "scripts/audit/domains/index/inspector.ts",
  });
  const inspection = await collectIndexInspection(context);

  const findings = [
    ...base.findings,
    ...inspection.findings,
  ];
  const phases = [
    ...base.phases,
    ...inspection.phases,
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