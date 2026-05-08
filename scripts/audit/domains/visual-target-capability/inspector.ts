import { readFileSync } from "node:fs";

import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { buildVisualTargetInspectorResult, runVisualTargetChecks } from "./inspection-phase-suite.js";

const VISUAL_TARGET_CAPABILITY_DOMAIN = "visual-target-capability";
const VISUAL_TARGET_INSPECTOR_ID = "visual-target-capability-owner";
const VISUAL_TARGET_INSPECTOR_ENTRY = "scripts/audit/domains/visual-target-capability/inspector.ts";

const AI_ONLY_VISUAL_TARGET_FILES = [
  "src/lib/local-runtime/workbench-action-dispatch-inputs.ts",
  "src/capabilities/visual-target/shared/visual-target-types.ts",
  "src/capabilities/visual-target/shared/visual-target-policy.ts",
] as const;

const AI_ONLY_VISUAL_TARGET_FORBIDDEN = [
  "heuristic_profile",
  "map_profile_heuristic",
  "operator_manual",
  "pageStateType: \"platform_feed\"",
  "decision: \"allow\"",
] as const;

function runAiOnlyVisualTargetBoundary() {
  const findings = AI_ONLY_VISUAL_TARGET_FILES.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return AI_ONLY_VISUAL_TARGET_FORBIDDEN
      .filter((token) => text.includes(token))
      .map((token) => createFinding({
        lawId: "GRASSEYE-VISUAL-TARGET-AI-CANDIDATE-ONLY-V1",
        file,
        line: 1,
        severity: "fatal" as const,
        message: `Visual Target must not generate or allow non-AI semantic candidates. Forbidden token: "${token}".`,
      }));
  });

  return {
    findings,
    phase: createPhase(
      "ai-only-visual-target-boundary",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Visual Target has no heuristic/manual target candidate generation surface."
        : "Visual Target still exposes heuristic/manual target candidate generation surface.",
    ),
  };
}

export async function inspectVisualTargetCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: VISUAL_TARGET_CAPABILITY_DOMAIN,
    inspectorId: VISUAL_TARGET_INSPECTOR_ID,
    inspectorEntry: VISUAL_TARGET_INSPECTOR_ENTRY,
  });
  const checks = await runVisualTargetChecks(context);
  const aiOnlyBoundary = runAiOnlyVisualTargetBoundary();
  const baseResult = buildVisualTargetInspectorResult(base, checks);
  const findings = [...baseResult.findings, ...aiOnlyBoundary.findings];
  const phases = [...baseResult.phases, aiOnlyBoundary.phase];

  return finalizeInspectorResult({
    inspector: "GrassEye Visual Target Capability Owner Inspector",
    inspectorId: VISUAL_TARGET_INSPECTOR_ID,
    capabilityDomain: VISUAL_TARGET_CAPABILITY_DOMAIN,
    findings,
    phases,
    summary: findings.length === 0
      ? baseResult.summary
      : "visual-target owner inspector found capability-boundary, chain-truth, or AI-only target-candidate violations",
  });
}

export const visualTargetCapabilityInspector = inspectVisualTargetCapability;
