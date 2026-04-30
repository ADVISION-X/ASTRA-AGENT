import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

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
  return issues;
}
