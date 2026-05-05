import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

const OPEN_TARGET_PROFILE_BY_CHILD = {
  "open-facebook": "open-target-profile:open-facebook",
  "open-tiktok": "open-target-profile:open-tiktok",
} as const;

function resolveInitialOpenChild(mapPackage: MapPackage): keyof typeof OPEN_TARGET_PROFILE_BY_CHILD | null {
  const initialStep = mapPackage.operationalMap.steps.find((step) => step.stepId === mapPackage.operationalMap.initialStepId);
  return initialStep?.childCapabilityId === "open-facebook" || initialStep?.childCapabilityId === "open-tiktok"
    ? initialStep.childCapabilityId
    : null;
}

function validateOpenTargetProfile(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const openChild = resolveInitialOpenChild(mapPackage);
  if (!openChild) {
    return [];
  }
  const expectedTargetProfileRef = OPEN_TARGET_PROFILE_BY_CHILD[openChild];
  return mapPackage.taskTemplate.targetProfileRef === expectedTargetProfileRef
    ? []
    : [{
        code: "invalid_platform_profile",
        message: `Task template targetProfileRef must be ${expectedTargetProfileRef} for ${openChild}.`,
        path: "taskTemplate.targetProfileRef",
        severity: "error",
      }];
}

export function validatePlatformProfiles(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const requestedPlatform = mapPackage.taskTemplate.requestedPlatformId;
  if (requestedPlatform && !mapPackage.taskTemplate.platformProfileRef) {
    issues.push({
      code: "missing_platform_profile",
      message: "Task template requestedPlatformId requires platformProfileRef.",
      path: "taskTemplate.platformProfileRef",
      severity: "error"
    });
  }
  if (requestedPlatform && !mapPackage.taskTemplate.targetProfileRef) {
    issues.push({
      code: "missing_platform_profile",
      message: "Task template requestedPlatformId requires targetProfileRef.",
      path: "taskTemplate.targetProfileRef",
      severity: "error"
    });
  }
  return [
    ...issues,
    ...validateOpenTargetProfile(mapPackage),
  ];
}
