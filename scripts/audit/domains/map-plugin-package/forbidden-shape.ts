import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import {
  BUILTINS_ROOT,
  ROOT,
  getSource,
  listMapPluginFiles,
  loadBuiltinPackageRecords,
} from "./ast-utils.js";

const FORBIDDEN_TEXT_FRAGMENTS = ["import(", "child_process", "npm run", "eval(", "function ", "=>", "node:"] as const;
const FORBIDDEN_IMPORT_MARKERS = [
  "/capabilities/orchestration/runtime/",
  "/capabilities/orchestration/maps/",
  "/capabilities/ai/",
  "/lib/browser/",
  "node:child_process",
] as const;

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const mapPluginFiles = await listMapPluginFiles();

  for (const file of mapPluginFiles.filter((filePath) => filePath.startsWith(`${BUILTINS_ROOT}/`) && filePath !== `${BUILTINS_ROOT}/index.ts`)) {
    if (!file.endsWith(".json")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-004-V1",
        file,
        line: 1,
        severity: "fatal",
        message: "Builtin map packages must stay JSON data packages and must not ship executable source files.",
      }));
    }
  }

  for (const record of await loadBuiltinPackageRecords()) {
    const securityIssue = record.validationIssues.find((issue) => issue.code === "security_violation");
    if (securityIssue) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-004-V1",
        file: record.file,
        line: 1,
        severity: "fatal",
        message: `Builtin map package contains executable or code-like payload content: ${securityIssue.message}`,
      }));
    }

    const forbiddenFragment = FORBIDDEN_TEXT_FRAGMENTS.find((fragment) => record.text.includes(fragment));
    if (forbiddenFragment) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-004-V1",
        file: record.file,
        line: 1,
        severity: "fatal",
        message: `Builtin map package must not contain executable-like fragment ${forbiddenFragment}.`,
      }));
    }
  }

  const sourceFiles = mapPluginFiles.filter((filePath) => filePath.endsWith(".ts"));
  for (const filePath of sourceFiles) {
    const source = getSource(project, filePath);
    const forbiddenImport = FORBIDDEN_IMPORT_MARKERS.find((marker) => hasImportModuleSpecifier(source, marker));
    if (forbiddenImport) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-004-V1",
        file: filePath,
        line: 1,
        severity: "fatal",
        message: `Map package source must not depend on executable runtime internals through ${forbiddenImport}.`,
      }));
    }

    if (hasCallExpression(source, "eval") || hasCallExpression(source, "Function") || hasCallExpression(source, "exec") || hasCallExpression(source, "spawn")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-004-V1",
        file: filePath,
        line: 1,
        severity: "fatal",
        message: "Map package source must not introduce executable payload helpers or shell escapes.",
      }));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Map package builtins remain declarative JSON and the package layer has no executable escape surfaces."
        : "Map package layer still contains executable payload or forbidden runtime escape shapes.",
    ),
  };
}
