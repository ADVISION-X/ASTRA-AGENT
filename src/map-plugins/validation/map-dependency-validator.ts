import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import type { OperationalMap } from "../../capabilities/orchestration/contract.js";
import { findRoutePlanById } from "../route-plans/index.js";

type TargetAbilityGroupId = NonNullable<OperationalMap["steps"][number]["targetAbilityGroupId"]>;

export function validateMapDependencies(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  const effectiveSteps = routePlan ? [...mapPackage.operationalMap.steps, ...routePlan.steps] : mapPackage.operationalMap.steps;
  const targetAbilities = new Set<string>(
    effectiveSteps
      .map((step) => step.targetAbilityGroupId)
      .filter((value): value is TargetAbilityGroupId => value !== null)
  );
  for (const requiredCapability of mapPackage.dependencies.requiredCapabilities) {
    if (!targetAbilities.has(requiredCapability)) {
      issues.push({
        code: "missing_dependency",
        message: `Required capability ${requiredCapability} is not referenced by the operational map.`,
        path: "dependencies.requiredCapabilities",
        severity: "error"
      });
    }
  }
  return issues;
}
