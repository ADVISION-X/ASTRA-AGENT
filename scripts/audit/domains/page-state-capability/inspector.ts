import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createPageStateAuditProject } from "./audit-project.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runEnforcementCoverage } from "./enforcement-coverage.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";
import { runTruthOwnership } from "./truth-ownership.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF";
const TARGET_NEGATIVE_PROOF_PHASE_ENV = "GRASSEYE_PAGE_STATE_NEGATIVE_PROOF_PHASE";
const TARGET_NEGATIVE_PROOF_PHASES = [
  "required",
  "forbidden",
  "boundary",
  "truth-ownership",
  "anti-escape",
  "enforcement-coverage",
] as const;

type TargetNegativeProofPhase = (typeof TARGET_NEGATIVE_PROOF_PHASES)[number];

function createSkippedNegativeProofPhase() {
  return {
    findings: [],
    phase: {
      name: "negative-proof-harness",
      classification: "PASS" as const,
      passed: true,
      summary: "Page State negative-proof harness was skipped for nested inspector execution.",
    },
  };
}

async function resolveNegativeProofPhase() {
  return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? createSkippedNegativeProofPhase()
    : await runNegativeProofHarness();
}

function resolveTargetNegativeProofPhase(): TargetNegativeProofPhase | null {
  const value = process.env[TARGET_NEGATIVE_PROOF_PHASE_ENV];
  return TARGET_NEGATIVE_PROOF_PHASES.includes(value as TargetNegativeProofPhase)
    ? value as TargetNegativeProofPhase
    : null;
}

async function runTargetedProjectPhase(phase: Exclude<TargetNegativeProofPhase, "enforcement-coverage">) {
  const project = createPageStateAuditProject();
  switch (phase) {
    case "required":
      return runRequiredShape(project);
    case "forbidden":
      return runForbiddenShape(project);
    case "boundary":
      return runBoundaryAttack(project);
    case "truth-ownership":
      return runTruthOwnership(project);
    case "anti-escape":
      return runAntiEscape(project);
  }
}

async function runTargetedPhaseCheck(context: InspectorContext, phase: TargetNegativeProofPhase) {
  return phase === "enforcement-coverage"
    ? runEnforcementCoverage(context)
    : runTargetedProjectPhase(phase);
}

async function runTargetedNegativeProofPhase(context: InspectorContext, phase: TargetNegativeProofPhase): Promise<InspectorResult> {
  const result = await runTargetedPhaseCheck(context, phase);

  return finalizeInspectorResult({
    inspector: "GrassEye Page State Capability Owner Inspector",
    inspectorId: "page-state-capability-owner",
    capabilityDomain: "page-state-capability",
    findings: result.findings,
    phases: [result.phase],
    summary: result.findings.length === 0
      ? `page-state targeted negative-proof phase ${phase} passed`
      : `page-state targeted negative-proof phase ${phase} found violations`,
  });
}

function collectInspectorFindings(input: {
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnership>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
  enforcementCoverage: Awaited<ReturnType<typeof runEnforcementCoverage>>;
  negativeProofFindings: Awaited<ReturnType<typeof resolveNegativeProofPhase>>["findings"];
}) {
  return [
    ...input.base.findings,
    ...input.required.findings,
    ...input.forbidden.findings,
    ...input.boundary.findings,
    ...input.truthOwnership.findings,
    ...input.antiEscape.findings,
    ...input.enforcementCoverage.findings,
    ...input.negativeProofFindings,
  ];
}

function collectInspectorPhases(input: {
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnership>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
  enforcementCoverage: Awaited<ReturnType<typeof runEnforcementCoverage>>;
  negativeProofPhase: Awaited<ReturnType<typeof resolveNegativeProofPhase>>["phase"];
}) {
  return [
    ...input.base.phases,
    input.required.phase,
    input.forbidden.phase,
    input.boundary.phase,
    input.truthOwnership.phase,
    input.antiEscape.phase,
    input.enforcementCoverage.phase,
    input.negativeProofPhase,
  ];
}

export async function inspectPageStateCapability(context: InspectorContext): Promise<InspectorResult> {
  const targetedNegativeProofPhase = resolveTargetNegativeProofPhase();
  if (targetedNegativeProofPhase) {
    return runTargetedNegativeProofPhase(context, targetedNegativeProofPhase);
  }

  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "page-state-capability",
    inspectorId: "page-state-capability-owner",
    inspectorEntry: "scripts/audit/domains/page-state-capability/inspector.ts",
  });
  const project = createPageStateAuditProject();
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = await runBoundaryAttack(project);
  const truthOwnership = runTruthOwnership(project);
  const antiEscape = await runAntiEscape(project);
  const enforcementCoverage = await runEnforcementCoverage(context);
  const negativeProof = await resolveNegativeProofPhase();
  const negativeProofFindings = negativeProof.findings;
  const negativeProofPhase = negativeProof.phase;
  const findings = collectInspectorFindings({ base, required, forbidden, boundary, truthOwnership, antiEscape, enforcementCoverage, negativeProofFindings });
  const phases = collectInspectorPhases({ base, required, forbidden, boundary, truthOwnership, antiEscape, enforcementCoverage, negativeProofPhase });

  return finalizeInspectorResult({
    inspector: "GrassEye Page State Capability Owner Inspector",
    inspectorId: "page-state-capability-owner",
    capabilityDomain: "page-state-capability",
    findings,
    phases,
    summary: findings.length === 0
      ? "page-state owner inspector passed required, forbidden, boundary, truth-ownership, anti-escape, enforcement-coverage, and negative-proof phases"
      : "page-state owner inspector found capability-boundary, enforcement, or governance violations",
  });
}
