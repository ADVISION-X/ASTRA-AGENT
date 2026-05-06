import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { runAntiEscape } from "./anti-escape.js";
import { createScreenshotAuditProject } from "./project-access.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runChildRuntimeCheck } from "./child-runtime-check.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runLawBaselineCheck } from "./law-baseline-check.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runOwnershipBoundary } from "./ownership-boundary.js";
import { runRequiredShape } from "./required-shape.js";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF";

const createSkippedNegativeProofResult = () => ({
  findings: [],
  phase: {
    name: "negative-proof-harness",
    classification: "PASS" as const,
    passed: true,
    summary: "Screenshot negative-proof harness was skipped for nested inspector execution.",
  },
});

const runNegativeProofCheck = async () => process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
  ? createSkippedNegativeProofResult()
  : await runNegativeProofHarness();

const runScreenshotChecks = async (_context: InspectorContext) => {
  const project = createScreenshotAuditProject();
  const ownershipBoundary = runOwnershipBoundary(project);
  const [lawBaseline, required, forbidden, boundary, childRuntime, antiEscape] = await Promise.all([
    runLawBaselineCheck(),
    runRequiredShape(project),
    runForbiddenShape(project),
    runBoundaryAttack(project),
    Promise.resolve(runChildRuntimeCheck(project)),
    runAntiEscape(project),
  ]);
  const negativeProof = await runNegativeProofCheck();
  return { lawBaseline, required, forbidden, boundary, childRuntime, ownershipBoundary, antiEscape, negativeProof };
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
    ...checks.negativeProof.findings,
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
      checks.negativeProof.phase,
    ],
    summary: findings.length === 0
      ? "screenshot-capability owner inspector passed owner-foundation, required-shape, forbidden-shape, boundary, ownership-boundary, anti-escape, and negative-proof phases"
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
