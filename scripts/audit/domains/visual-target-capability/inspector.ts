import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { runAntiEscapeAttack } from "./run-anti-escape-attack.js";
import { runBoundaryAttack } from "./run-boundary-attack.js";
import { runForbiddenShapeAttack } from "./run-forbidden-shape-attack.js";
import { runGeneratedChainCheck } from "./run-generated-chain-check.js";
import { runManifestCheck } from "./run-manifest-check.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runPipelineTruthAttack } from "./run-pipeline-truth-attack.js";
import { createVisualTargetAuditProject, runRequiredShapeAttack } from "./run-required-shape-attack.js";
import { runRunnerFailPowerCheck } from "./run-runner-fail-power-check.js";
import { runTruthOwnershipAttack } from "./run-truth-ownership-attack.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF";

const createSkippedNegativeProofResult = () => ({
  findings: [],
  phase: {
    name: "negative-proof-harness",
    classification: "PASS" as const,
    passed: true,
    summary: "Visual Target negative-proof harness was skipped for nested inspector execution.",
  },
});

const runNegativeProofCheck = async () => process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
  ? createSkippedNegativeProofResult()
  : await runNegativeProofHarness();

const runVisualTargetChecks = async (context: InspectorContext) => {
  const project = createVisualTargetAuditProject();
  const typeChecker = project.getTypeChecker();
  const [required, forbidden, boundary, antiEscape, pipelineTruth, runnerFailPower, truthOwnership, negativeProof] = await Promise.all([
    runRequiredShapeAttack(project),
    runForbiddenShapeAttack(project),
    runBoundaryAttack(project, typeChecker),
    runAntiEscapeAttack(project),
    runPipelineTruthAttack(project),
    runRunnerFailPowerCheck(project),
    runTruthOwnershipAttack(project),
    runNegativeProofCheck(),
  ]);
  const generatedChain = await runGeneratedChainCheck(context);
  const manifest = await runManifestCheck();
  return { required, forbidden, boundary, antiEscape, generatedChain, manifest, pipelineTruth, runnerFailPower, truthOwnership, negativeProof };
};

const buildVisualTargetInspectorResult = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  checks: Awaited<ReturnType<typeof runVisualTargetChecks>>,
): Omit<InspectorResult, "passed" | "classification" | "violationCount"> => {
  const findings = [
    ...base.findings,
    ...checks.required.findings,
    ...checks.forbidden.findings,
    ...checks.boundary.findings,
    ...checks.antiEscape.findings,
    ...checks.generatedChain.findings,
    ...checks.manifest.findings,
    ...checks.pipelineTruth.findings,
    ...checks.runnerFailPower.findings,
    ...checks.truthOwnership.findings,
    ...checks.negativeProof.findings,
  ];
  return {
    inspector: "GrassEye Visual Target Capability Owner Inspector",
    inspectorId: "visual-target-capability-owner",
    capabilityDomain: "visual-target-capability",
    findings,
    phases: [
      ...base.phases,
      checks.required.phase,
      checks.forbidden.phase,
      checks.boundary.phase,
      checks.antiEscape.phase,
      checks.generatedChain.phase,
      checks.manifest.phase,
      checks.pipelineTruth.phase,
      checks.runnerFailPower.phase,
      checks.truthOwnership.phase,
      checks.negativeProof.phase,
    ],
    summary: findings.length === 0
      ? "visual-target owner inspector passed required, forbidden, boundary, anti-escape, generated-chain, manifest, pipeline-truth, runner-fail-power, truth-ownership, and negative-proof phases"
      : "visual-target owner inspector found capability-boundary, chain-truth, or enforcement violations",
  };
};

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
