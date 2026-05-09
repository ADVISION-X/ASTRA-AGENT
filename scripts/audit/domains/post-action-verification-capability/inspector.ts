import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createPostActionAuditProject } from "./project-access.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runGovernedRuntimeChecks } from "./run-governed-runtime-checks.js";
import { runLawBaselineCheck } from "./run-law-baseline-check.js";
import { runRequiredShape } from "./required-shape.js";
import { runTruthOwnershipAttack } from "./run-truth-ownership-attack.js";

function collectFindings(input: {
  base: Pick<InspectorResult, "findings" | "phases">;
  lawBaseline: Awaited<ReturnType<typeof runLawBaselineCheck>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  governedRuntime: Awaited<ReturnType<typeof runGovernedRuntimeChecks>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnershipAttack>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
}) {
  return [
    ...input.base.findings,
    ...input.lawBaseline.findings,
    ...input.required.findings,
    ...input.governedRuntime.findings,
    ...input.forbidden.findings,
    ...input.boundary.findings,
    ...input.truthOwnership.findings,
    ...input.antiEscape.findings,
  ];
}

function collectPhases(input: {
  base: Pick<InspectorResult, "findings" | "phases">;
  lawBaseline: Awaited<ReturnType<typeof runLawBaselineCheck>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  governedRuntime: Awaited<ReturnType<typeof runGovernedRuntimeChecks>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnershipAttack>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
}) {
  return [
    ...input.base.phases,
    input.lawBaseline.phase,
    input.required.phase,
    ...input.governedRuntime.phases,
    input.forbidden.phase,
    input.boundary.phase,
    input.truthOwnership.phase,
    input.antiEscape.phase,
  ];
}

export async function inspectPostActionVerificationCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "post-action-verification-capability",
    inspectorId: "post-action-verification-capability-owner",
    inspectorEntry: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
  });
  const project = createPostActionAuditProject();
  const lawBaseline = await runLawBaselineCheck();
  const required = await runRequiredShape(project);
  const governedRuntime = await runGovernedRuntimeChecks(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = await runBoundaryAttack(project);
  const truthOwnership = runTruthOwnershipAttack(project);
  const antiEscape = await runAntiEscape(project);
  const findings = collectFindings({ base, lawBaseline, required, governedRuntime, forbidden, boundary, truthOwnership, antiEscape });
  const phases = collectPhases({ base, lawBaseline, required, governedRuntime, forbidden, boundary, truthOwnership, antiEscape });

  return finalizeInspectorResult({
    inspector: "GrassEye Post-action Verification Capability Owner Inspector",
    inspectorId: "post-action-verification-capability-owner",
    capabilityDomain: "post-action-verification-capability",
    findings,
    phases,
    summary: findings.length === 0
      ? "post-action-verification owner inspector passed law-baseline, required, governed-runtime, forbidden, boundary, truth-ownership, and anti-escape phases"
      : "post-action-verification owner inspector found capability-boundary or governance violations",
  });
}
