import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

const FORBIDDEN_KEYS = new Set([
  "handler",
  "function",
  "script",
  "command",
  "shell",
  "exec",
  "eval",
  "rawprompt",
  "systemprompt",
  "userprompt",
  "messages",
  "template",
  "instruction",
  "instructions",
  "content",
  "executablepromptlogic",
  "javascript",
  "code",
  "callback",
  "resolver",
]);
const FORBIDDEN_STRING_FRAGMENTS = [
  "import(",
  "function ",
  "=>",
  "node:",
  "child_process",
  "raw prompt",
  "system prompt",
  "user prompt",
  "executable prompt",
  "npm run",
  "eval(",
  "new function",
  "javascript:",
  "require(",
];

function normalizeValue(value: string): string {
  return value.toLowerCase();
}

function recordForbiddenStringFragments(value: string, path: string, issues: MapPackageValidationIssue[]): void {
  for (const fragment of FORBIDDEN_STRING_FRAGMENTS) {
    if (normalizeValue(value).includes(fragment)) {
      issues.push({
        code: "security_violation",
        message: `Forbidden code-like fragment ${fragment} found in map package content.`,
        path,
        severity: "fatal"
      });
    }
  }
}

function walkArray(values: unknown[], path: string, issues: MapPackageValidationIssue[]): void {
  values.forEach((entry, index) => walk(entry, `${path}[${index}]`, issues));
}

function walkObject(value: object, path: string, issues: MapPackageValidationIssue[]): void {
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${entryKey}` : entryKey;
    if (FORBIDDEN_KEYS.has(normalizeValue(entryKey))) {
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

function walk(value: unknown, path: string, issues: MapPackageValidationIssue[]): void {
  if (Array.isArray(value)) {
    walkArray(value, path, issues);
    return;
  }
  if (typeof value === "string") {
    recordForbiddenStringFragments(value, path, issues);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  walkObject(value, path, issues);
}

export function validateMapSecurity(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  walk(mapPackage, "", issues);
  return issues;
}
