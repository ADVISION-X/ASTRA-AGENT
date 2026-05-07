export const MAP_PACKAGE_FAILURE_REASONS = [
  "map_not_found",
  "map_not_active",
  "automation_gate_not_passed",
  "map_incompatible",
  "map_validation_failed",
  "missing_dependency",
  "missing_prompt_contract",
  "missing_platform_profile",
  "security_violation",
  "transition_not_closed"
] as const;

export type MapPackageFailureReason = (typeof MAP_PACKAGE_FAILURE_REASONS)[number];

export type MapPackageValidationIssue = {
  code: MapPackageFailureReason | string;
  message: string;
  path?: string;
  severity: "error" | "fatal";
};
