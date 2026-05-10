import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { runAntiEscape } from "./anti-escape.js";
import {
  runBoundaryAttack,
  runChildRuntimeCheck,
  runForbiddenShape,
  runLawBaselineCheck,
  runOwnershipBoundary,
  runProductPresenceLightweightCheck,
  runRequiredShape,
  runVisualMissionShape,
} from "./phase-runners.js";
import { createScreenshotAuditProject } from "./project-access.js";

const runScreenshotChecks = async (_context: InspectorContext) => {
  const project = createScreenshotAuditProject();
  const ownershipBoundary = runOwnershipBoundary(project);
  const [lawBaseline, required, forbidden, boundary, childRuntime, antiEscape, productPresenceLightweight, visualMission] = await Promise.all([
    runLawBaselineCheck(),
    runRequiredShape(project),
    runForbiddenShape(project),
    runBoundaryAttack(project),
    Promise.resolve(runChildRuntimeCheck(project)),
    runAntiEscape(project),
    Promise.resolve(runProductPresenceLightweightCheck(project)),
    Promise.resolve(runVisualMissionShape(project)),
  ]);
  return { lawBaseline, required, forbidden, boundary, childRuntime, ownershipBoundary, antiEscape, productPresenceLightweight, visualMission };
};

const buildInspectorResult = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  checks: Awaited<ReturnType<typeof runScreenshotChecks>>,
) => {
  const findings = [
    ...base.findings,
    ...checks.lawBaseline.findings,
    ...checks.required.findings,
    ...checks.forbidden.findings,
    ...checks.boundary.findings,
    ...checks.childRuntime.findings,
    ...checks.ownershipBoundary.findings,
    ...checks.antiEscape.findings,
    ...checks.productPresenceLightweight.findings,
    ...checks.visualMission.findings,
  ];

  return {
    inspector: "GrassEye Screenshot Capability Owner Inspector",
    inspectorId: "screenshot-capability-owner",
    capabilityDomain: "screenshot-capability",
    findings,
    phases: [
      ...base.phases,
      checks.lawBaseline.phase,
      checks.required.phase,
      checks.forbidden.phase,
      checks.boundary.phase,
      checks.childRuntime.phase,
      checks.ownershipBoundary.phase,
      checks.antiEscape.phase,
      checks.productPresenceLightweight.phase,
      checks.visualMission.phase,
    ],
    summary: findings.length === 0
      ? "screenshot-capability owner inspector passed owner-foundation, required-shape, visual-mission-shape, forbidden-shape, boundary, ownership-boundary, and anti-escape phases"
      : "screenshot-capability owner inspector found capability-boundary, chain-truth, or enforcement violations",
  };
};

export async function inspectScreenshotCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "screenshot-capability",
    inspectorId: "screenshot-capability-owner",
    inspectorEntry: "scripts/audit/domains/screenshot-capability/inspector.ts",
  });
  const checks = await runScreenshotChecks(context);
  return finalizeInspectorResult(buildInspectorResult(base, checks));
}

export const screenshotCapabilityInspector = inspectScreenshotCapability;
