import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";
import { inspectCodeTopology } from "../code-topology/components/inspect-code-topology.js";

import { runAbilityContractChecks } from "./run-ability-contract-checks.js";
import { runAiOnlyCognitionSurfaceChecks } from "./run-ai-only-cognition-surface-checks.js";
import { runAiOnlyMediaChangeChecks } from "./run-ai-only-media-change-checks.js";
import { runBoundaryImportChecks } from "./run-boundary-import-checks.js";
import { runOwnerRuntimeProofChecks } from "./run-owner-runtime-proof-checks.js";
import { runPackageAuditScriptChecks } from "./run-package-audit-script-checks.js";
import { runRetiredRootChecks } from "./run-retired-root-checks.js";

type CapabilityGroupExtraChecks = {
  findings: Finding[];
  phases: InspectorPhase[];
};

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

export const runCapabilityGroupGovernanceExtraChecks = async (
  context: InspectorContext,
): Promise<CapabilityGroupExtraChecks> => {
  const project = getAuditProject();
  const checks: CapabilityGroupExtraChecks = { findings: [], phases: [] };

  await runAsyncCheckIf(true, runPackageAuditScriptChecks, checks);
  await runAsyncCheckIf(true, () => runRetiredRootChecks(project), checks);
  await runAsyncCheckIf(true, runAbilityContractChecks, checks);
  runSyncCheckIf(true, () => runBoundaryImportChecks(project), checks);
  runSyncCheckIf(true, () => runAiOnlyMediaChangeChecks(project), checks);
  runSyncCheckIf(true, () => runAiOnlyCognitionSurfaceChecks(project), checks);
  runSyncCheckIf(true, () => runOwnerRuntimeProofChecks(project), checks);
  await runAsyncCheckIf(true, () => inspectCodeTopology(context), checks);

  return checks;
};