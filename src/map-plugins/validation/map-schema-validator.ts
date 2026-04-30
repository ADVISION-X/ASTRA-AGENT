import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";

export function validateMapSchema(input: unknown): { parsed: MapPackage | null; issues: MapPackageValidationIssue[] } {
  const parsed = MapPackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      parsed: null,
      issues: parsed.error.issues.map((issue) => ({
        code: "map_validation_failed",
        message: issue.message,
        path: issue.path.join("."),
        severity: "fatal"
      }))
    };
  }
  return { parsed: parsed.data, issues: [] };
}
