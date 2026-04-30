import { validateCapabilityRegistry } from "./map-capability-registry-validator.js";
import { validateMapVersionRequirements } from "./map-version-requirement-validator.js";
import { validateMapDependencies } from "./map-dependency-validator.js";
import { validateMapDryRun } from "./map-dry-run-validator.js";
import { validatePlatformProfiles } from "./map-platform-profile-validator.js";
import { validatePromptContracts } from "./map-prompt-contract-validator.js";
import { validateMapSchema } from "./map-schema-validator.js";
import { validateMapSecurity } from "./map-security-validator.js";
import { validateMapTransitionClosure } from "./map-transition-closure-validator.js";
import type { MapPackage } from "../shared/map-package-types.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";

export type MapPackageValidationResult = {
  ok: boolean;
  mapPackage: MapPackage | null;
  issues: MapPackageValidationIssue[];
};

export function validateMapPackage(input: unknown): MapPackageValidationResult {
  const schemaResult = validateMapSchema(input);
  if (!schemaResult.parsed) {
    return { ok: false, mapPackage: null, issues: schemaResult.issues };
  }

  const issues = [
    ...schemaResult.issues,
    ...validateMapDependencies(schemaResult.parsed),
    ...validateMapTransitionClosure(schemaResult.parsed),
    ...validateCapabilityRegistry(schemaResult.parsed),
    ...validatePromptContracts(schemaResult.parsed),
    ...validatePlatformProfiles(schemaResult.parsed),
    ...validateMapVersionRequirements(schemaResult.parsed),
    ...validateMapSecurity(schemaResult.parsed),
    ...validateMapDryRun(schemaResult.parsed)
  ];

  return {
    ok: issues.length === 0,
    mapPackage: schemaResult.parsed,
    issues
  };
}
