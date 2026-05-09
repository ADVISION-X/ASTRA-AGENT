import type { InspectorContext, InspectorResult } from "../../core/schema.js";

import { runAntiEscapeAttack } from "./run-anti-escape-attack.js";
import { runBoundaryAttack } from "./run-boundary-attack.js";
import { runForbiddenShapeAttack } from "./run-forbidden-shape-attack.js";
import { runGeneratedChainCheck } from "./run-generated-chain-check.js";
import { runManifestCheck } from "./run-manifest-check.js";
import { runPipelineTruthAttack } from "./run-pipeline-truth-attack.js";
import { createVisualTargetAuditProject, runRequiredShapeAttack } from "./run-required-shape-attack.js";
import { runRunnerFailPowerCheck } from "./run-runner-fail-power-check.js";
import { runTruthOwnershipAttack } from "./run-truth-ownership-attack.js";




export const runVisualTargetChecks = async (context: InspectorContext) => {
  const project = createVisualTargetAuditProject();
  const typeChecker = project.getTypeChecker();
  const [required, forbidden, boundary, antiEscape, pipelineTruth, runnerFailPower, truthOwnership] = await Promise.all([
    runRequiredShapeAttack(project),
    runForbiddenShapeAttack(project),
    runBoundaryAttack(project, typeChecker),
    runAntiEscapeAttack(project),
    runPipelineTruthAttack(project),
    runRunnerFailPowerCheck(project),
    runTruthOwnershipAttack(project),
  ]);
  const generatedChain = await runGeneratedChainCheck(context);
  const manifest = await runManifestCheck();
  return { required, forbidden, boundary, antiEscape, generatedChain, manifest, pipelineTruth, runnerFailPower, truthOwnership };
};

export const buildVisualTargetInspectorResult = (
  base: Awaited<ReturnType<typeof import("../_shared/owner-foundation-inspection.js").runDomainOwnerInspection>>,
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
    ],
    summary: findings.length === 0
      ? "visual-target owner inspector passed required, forbidden, boundary, anti-escape, generated-chain, manifest, pipeline-truth, runner-fail-power, and truth-ownership phases"
      : "visual-target owner inspector found capability-boundary, chain-truth, or enforcement violations",
  };
};