import type { InspectorContext } from "../../core/schema.js";

import { runAbilityGroupExpansionBlueprintChecks } from "./run-ability-group-expansion-blueprint-checks.js";
import { runAbilityGroupExpansionMachineChecks } from "./run-ability-group-expansion-machine-checks.js";
import { runBlueprintBaselineChecks } from "./run-blueprint-baseline-checks.js";
import { runBlueprintGovernanceChecks } from "./run-blueprint-governance-checks.js";
import { runDeleteRebuildBlueprintChecks } from "./run-delete-rebuild-blueprint-checks.js";
import { runDeleteRebuildMachineChecks } from "./run-delete-rebuild-machine-checks.js";
import { runIndexRoutingChecks } from "./run-index-routing-checks.js";
import { runIndexOwnerSurfaceChecks } from "./run-owner-surface-checks.js";
import { runStandardPackageBlueprintChecks } from "./run-standard-package-blueprint-checks.js";
import { runStandardPackagePrincipleChecks } from "./run-standard-package-principle-checks.js";

export async function collectIndexInspectionWithoutNegativeProof(context: InspectorContext) {
  const ownerSurface = await runIndexOwnerSurfaceChecks(context);
  const routingChecks = await runIndexRoutingChecks();
  const abilityGroupExpansionBlueprintChecks = await runAbilityGroupExpansionBlueprintChecks();
  const abilityGroupExpansionMachineChecks = await runAbilityGroupExpansionMachineChecks();
  const blueprintChecks = await runBlueprintBaselineChecks();
  const blueprintGovernanceChecks = await runBlueprintGovernanceChecks();
  const deleteRebuildBlueprintChecks = await runDeleteRebuildBlueprintChecks();
  const deleteRebuildMachineChecks = await runDeleteRebuildMachineChecks();
  const standardPackageBlueprintChecks = await runStandardPackageBlueprintChecks();
  const standardPackagePrincipleChecks = await runStandardPackagePrincipleChecks();

  return {
    findings: [
      ...ownerSurface.findings,
      ...routingChecks.findings,
      ...abilityGroupExpansionBlueprintChecks.findings,
      ...abilityGroupExpansionMachineChecks.findings,
      ...blueprintChecks.findings,
      ...blueprintGovernanceChecks.findings,
      ...deleteRebuildBlueprintChecks.findings,
      ...deleteRebuildMachineChecks.findings,
      ...standardPackageBlueprintChecks.findings,
      ...standardPackagePrincipleChecks.findings,
    ],
    phases: [
      ...ownerSurface.phases,
      ...routingChecks.phases,
      ...abilityGroupExpansionBlueprintChecks.phases,
      ...abilityGroupExpansionMachineChecks.phases,
      ...blueprintChecks.phases,
      ...blueprintGovernanceChecks.phases,
      ...deleteRebuildBlueprintChecks.phases,
      ...deleteRebuildMachineChecks.phases,
      ...standardPackageBlueprintChecks.phases,
      ...standardPackagePrincipleChecks.phases,
    ],
  };
}

export const buildIndexInspectionSummary = (findingsCount: number): string =>
  findingsCount === 0
    ? "index routing owner keeps repo-local law routing wired and enforceable"
    : "index routing owner has owner-surface or law-routing drift";