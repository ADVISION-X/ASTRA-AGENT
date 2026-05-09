import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";
import { inspectCodeTopology } from "../code-topology/components/inspect-code-topology.js";

import { runAbilityContractChecks } from "./run-ability-contract-checks.js";
import { runAiOnlyCognitionSurfaceChecks } from "./run-ai-only-cognition-surface-checks.js";
import { runAiOnlyMediaChangeChecks } from "./run-ai-only-media-change-checks.js";
import { runBoundaryImportChecks } from "./run-boundary-import-checks.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runNegativeProofWiringChecks } from "./run-negative-proof-wiring-checks.js";
import { runOwnerRuntimeProofChecks } from "./run-owner-runtime-proof-checks.js";
import { runPackageAuditScriptChecks } from "./run-package-audit-script-checks.js";
import { runRetiredRootChecks } from "./run-retired-root-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF";
const NEGATIVE_PROOF_PHASE_ENV = "GRASSEYE_CAPABILITY_GROUP_NEGATIVE_PROOF_PHASE";

type TargetNegativeProofPhase =
  | "package-audit-entrypoints"
  | "negative-proof-wiring"
  | "ai-only-media-change-boundary"
  | "ai-only-cognition-surface-boundary";

type CapabilityGroupExtraChecks = {
  findings: Finding[];
  phases: InspectorPhase[];
};

const shouldRunNegativeProofPhase = (phase: TargetNegativeProofPhase): boolean => {
  const selectedPhase = process.env[NEGATIVE_PROOF_PHASE_ENV];
  return selectedPhase === undefined || selectedPhase === phase;
};

const shouldRunFullInspectorSurface = (): boolean => process.env[NEGATIVE_PROOF_PHASE_ENV] === undefined;

const appendCheckResult = (
  target: CapabilityGroupExtraChecks,
  input: { findings: Finding[]; phases: InspectorPhase[] },
): void => {
  target.findings.push(...input.findings);
  target.phases.push(...input.phases);
};

const runAsyncCheckIf = async (
  condition: boolean,
  execute: () => Promise<{ findings: Finding[]; phases: InspectorPhase[] }>,
  target: CapabilityGroupExtraChecks,
): Promise<void> => {
  if (!condition) {
    return;
  }
  appendCheckResult(target, await execute());
};

const runSyncCheckIf = (
  condition: boolean,
  execute: () => { findings: Finding[]; phases: InspectorPhase[] },
  target: CapabilityGroupExtraChecks,
): void => {
  if (!condition) {
    return;
  }
  appendCheckResult(target, execute());
};

const getNegativeProofResult = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  if (process.env[SKIP_NEGATIVE_PROOF_ENV] === "1") {
    return {
      findings: [],
      phases: [{
        name: "negative-proof-harness",
        classification: "PASS",
        passed: true,
        summary: "Capability-group-governance negative-proof harness was skipped for nested inspector execution.",
      }],
    };
  }

  const negativeProof = await runNegativeProofHarness();
  return { findings: negativeProof.findings, phases: [negativeProof.phase] };
};

export const runCapabilityGroupGovernanceExtraChecks = async (
  context: InspectorContext,
): Promise<CapabilityGroupExtraChecks> => {
  const project = getAuditProject();
  const checks: CapabilityGroupExtraChecks = { findings: [], phases: [] };

  await runAsyncCheckIf(shouldRunNegativeProofPhase("package-audit-entrypoints"), runPackageAuditScriptChecks, checks);
  await runAsyncCheckIf(shouldRunFullInspectorSurface(), () => runRetiredRootChecks(project), checks);
  await runAsyncCheckIf(shouldRunFullInspectorSurface(), runAbilityContractChecks, checks);
  runSyncCheckIf(shouldRunFullInspectorSurface(), () => runBoundaryImportChecks(project), checks);
  runSyncCheckIf(shouldRunNegativeProofPhase("ai-only-media-change-boundary"), () => runAiOnlyMediaChangeChecks(project), checks);
  runSyncCheckIf(shouldRunNegativeProofPhase("ai-only-cognition-surface-boundary"), () => runAiOnlyCognitionSurfaceChecks(project), checks);
  runSyncCheckIf(shouldRunFullInspectorSurface(), () => runOwnerRuntimeProofChecks(project), checks);
  await runAsyncCheckIf(shouldRunNegativeProofPhase("negative-proof-wiring"), () => runNegativeProofWiringChecks(project), checks);
  await runAsyncCheckIf(shouldRunFullInspectorSurface(), () => inspectCodeTopology(context), checks);
  appendCheckResult(checks, await getNegativeProofResult());

  return checks;
};