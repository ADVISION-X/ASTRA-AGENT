import type { Finding, InspectorPhase } from "../../core/schema.js";

import { runChildContractGovernanceChecks } from "./run-child-contract-governance-checks.js";
import { runChildOwnershipChecks } from "./run-child-ownership-checks.js";
import { runDeletedOwnerBaselineChecks } from "./run-deleted-owner-baseline-checks.js";
import { runGeneratedSyncPrincipleChecks } from "./run-generated-sync-principle-checks.js";
import { runKernelChecks } from "./run-kernel-checks.js";
import { runKernelOwnerSurfaceChecks } from "./run-owner-surface-checks.js";

export async function runKernelGovernancePhaseSuite(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const surface = await runKernelOwnerSurfaceChecks();
  const kernelChecks = await runKernelChecks();
  const childOwnership = await runChildOwnershipChecks();
  const childContractGovernance = await runChildContractGovernanceChecks();
  const deletedOwnerBaseline = await runDeletedOwnerBaselineChecks();
  const generatedSyncPrinciples = await runGeneratedSyncPrincipleChecks();

  return {
    findings: [
      ...surface.findings,
      ...kernelChecks.findings,
      ...childOwnership.findings,
      ...childContractGovernance.findings,
      ...deletedOwnerBaseline.findings,
      ...generatedSyncPrinciples.findings,
    ],
    phases: [
      ...surface.phases,
      ...kernelChecks.phases,
      ...childOwnership.phases,
      ...childContractGovernance.phases,
      ...deletedOwnerBaseline.phases,
      ...generatedSyncPrinciples.phases,
    ],
  };
}