import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS } from "../schema/operational-map-core.schema.js";

const GOVERNED_ABILITY_GROUP_REGISTRY = new Set(MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS);

export function validateCapabilityRegistry(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  for (const step of mapPackage.operationalMap.steps) {
    if (step.targetAbilityGroupId && !GOVERNED_ABILITY_GROUP_REGISTRY.has(step.targetAbilityGroupId)) {
      issues.push({
        code: "missing_dependency",
        message: `Target ability group ${step.targetAbilityGroupId} is outside the governed registry snapshot.`,
        path: `operationalMap.steps.${step.stepId}`,
        severity: "fatal"
      });
    }
  }
  return issues;
}
