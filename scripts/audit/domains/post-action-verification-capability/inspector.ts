import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createPostActionAuditProject } from "./project-access.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runLawBaselineCheck } from "./run-law-baseline-check.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";
import { runTruthOwnershipAttack } from "./run-truth-ownership-attack.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF";

function createSkippedNegativeProofResult() {
  return {
    findings: [],
    phase: {
      name: "negative-proof-harness",
      classification: "PASS" as const,
      passed: true,
      summary: "Post Action Verification negative-proof harness was skipped for nested inspector execution.",
    },
  };
}

async function resolveNegativeProof() {
  return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? createSkippedNegativeProofResult()
    : await runNegativeProofHarness();
}

function collectFindings(input: {
  base: Pick<InspectorResult, "findings" | "phases">;
  lawBaseline: Awaited<ReturnType<typeof runLawBaselineCheck>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnershipAttack>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
  negativeProof: Awaited<ReturnType<typeof resolveNegativeProof>>;
}) {
  return [
    ...input.base.findings,
    ...input.lawBaseline.findings,
    ...input.required.findings,
    ...input.forbidden.findings,
    ...input.boundary.findings,
    ...input.truthOwnership.findings,
    ...input.antiEscape.findings,
    ...input.negativeProof.findings,
  ];
}

function collectPhases(input: {
  base: Pick<InspectorResult, "findings" | "phases">;
  lawBaseline: Awaited<ReturnType<typeof runLawBaselineCheck>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnershipAttack>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
  negativeProof: Awaited<ReturnType<typeof resolveNegativeProof>>;
}) {
  return [
    ...input.base.phases,
    input.lawBaseline.phase,
    input.required.phase,
    input.forbidden.phase,
    input.boundary.phase,
    input.truthOwnership.phase,
    input.antiEscape.phase,
    input.negativeProof.phase,
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
  const forbidden = await runForbiddenShape(project);
  const boundary = await runBoundaryAttack(project);
  const truthOwnership = runTruthOwnershipAttack(project);
  const antiEscape = await runAntiEscape(project);
  const negativeProof = await resolveNegativeProof();
  const findings = collectFindings({ base, lawBaseline, required, forbidden, boundary, truthOwnership, antiEscape, negativeProof });
  const phases = collectPhases({ base, lawBaseline, required, forbidden, boundary, truthOwnership, antiEscape, negativeProof });

  return finalizeInspectorResult({
    inspector: "GrassEye Post-action Verification Capability Owner Inspector",
    inspectorId: "post-action-verification-capability-owner",
    capabilityDomain: "post-action-verification-capability",
    findings,
    phases,
    summary: findings.length === 0
      ? "post-action-verification owner inspector passed law-baseline, required, forbidden, boundary, truth-ownership, anti-escape, and negative-proof phases"
      : "post-action-verification owner inspector found capability-boundary or governance violations",
  });
}
