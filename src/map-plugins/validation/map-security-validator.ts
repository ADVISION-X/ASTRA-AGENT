import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

const FORBIDDEN_KEYS = new Set(["handler", "function", "script", "command", "shell", "exec", "eval"]);
const FORBIDDEN_STRING_FRAGMENTS = ["import(", "function ", "=>", "node:", "child_process", "raw prompt", "npm run"];

function walk(value: unknown, path: string, issues: MapPackageValidationIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`, issues));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      for (const fragment of FORBIDDEN_STRING_FRAGMENTS) {
        if (value.includes(fragment)) {
          issues.push({
            code: "security_violation",
            message: `Forbidden code-like fragment ${fragment} found in map package content.`,
            path,
            severity: "fatal"
          });
        }
      }
    }
    return;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${entryKey}` : entryKey;
    if (FORBIDDEN_KEYS.has(entryKey)) {
      issues.push({
        code: "security_violation",
        message: `Forbidden executable field ${entryKey} found in map package.`,
        path: nextPath,
        severity: "fatal"
      });
    }
    walk(entryValue, nextPath, issues);
  }
}

export function validateMapSecurity(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  walk(mapPackage, "", issues);
  return issues;
}
