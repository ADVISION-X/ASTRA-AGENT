import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { buildVisualTargetInspectorResult, runVisualTargetChecks } from "./inspection-phase-suite.js";

export async function inspectVisualTargetCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "visual-target-capability",
    inspectorId: "visual-target-capability-owner",
    inspectorEntry: "scripts/audit/domains/visual-target-capability/inspector.ts",
  });
  const checks = await runVisualTargetChecks(context);
  return finalizeInspectorResult(buildVisualTargetInspectorResult(base, checks));
}

export const visualTargetCapabilityInspector = inspectVisualTargetCapability;
