import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

const CURRENT_GRASSEYE_VERSION = "0.1.0";
const CURRENT_SCHEMA_VERSION = "1";

export function validateCompatibility(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  if (!CURRENT_GRASSEYE_VERSION.startsWith(mapPackage.compatibility.requiresGrassEye.split(".")[0] ?? "")) {
    issues.push({
      code: "map_incompatible",
      message: `GrassEye version ${CURRENT_GRASSEYE_VERSION} does not satisfy ${mapPackage.compatibility.requiresGrassEye}.`,
      path: "compatibility.requiresGrassEye",
      severity: "error"
    });
  }
  if (mapPackage.compatibility.requiresMapSchema !== CURRENT_SCHEMA_VERSION) {
    issues.push({
      code: "map_incompatible",
      message: `Map schema ${mapPackage.compatibility.requiresMapSchema} does not match current schema ${CURRENT_SCHEMA_VERSION}.`,
      path: "compatibility.requiresMapSchema",
      severity: "error"
    });
  }
  return issues;
}
