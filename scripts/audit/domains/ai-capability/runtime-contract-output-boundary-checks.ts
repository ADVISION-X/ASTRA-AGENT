import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment, hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";

const { AI_ROOT } = aiInspectionConstants;
const REQUIRED_BOUNDARY_ALIASES = ["type_command", "press_key", "drag_command", "persist_evidence", "dispatch_envelope", "nerve_bus_dispatch"] as const;
const REQUIRED_SUCCESS_INVARIANT_CONDITIONS = [
  'value.createdAt !== null && value.rawOutputRef === null',
  'value.createdAt !== null && value.rawOutputHash === null',
  'value.status === "success" && value.rawOutputRef === null',
  'value.status === "success" && value.rawOutputHash === null',
  'value.status === "success" && value.runtimeProof.rawOutputRef === null',
  'value.status === "success" && value.runtimeProof.rawOutputHash === null',
] as const;

const toConditionVariants = (fragment: string): string[] => [fragment, fragment.replaceAll("value.", "input.")];

const hasConditionFragment = (sourceFile: SourceFile, fragment: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expressionText = statement.getExpression().getText();
    return toConditionVariants(fragment).some((variant) => expressionText.includes(variant));
  });

const findOutputBoundaryGateViolations = (sourceFile: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  if (!hasCallExpression(sourceFile, "safeParse") || !hasImportModuleSpecifier(sourceFile, "schema")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must include a schema-level forbidden action output gate." }));
  }
  if (!hasCallExpression(sourceFile, "collectForbiddenFields") || !sourceFile.getVariableDeclaration("FORBIDDEN_OUTPUT_KEYS")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must recursively reject forbidden action output fields and aliases." }));
  }
  return findings;
};

const findOutputBoundaryAliasViolations = (input: {
  outputBoundarySource: SourceFile;
  runtimeBoundarySchemaSource: SourceFile;
}): Finding[] => {
  if (!REQUIRED_BOUNDARY_ALIASES.some((alias) => !hasStringLiteral(input.outputBoundarySource, alias) || !hasStringLiteral(input.runtimeBoundarySchemaSource, alias))) {
    return [];
  }

  return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must reject expanded action aliases for text input, navigation, forensics, and dispatch outputs." })];
};

const hasRuntimeSuccessInvariantCoverage = (sourceFile: SourceFile): boolean => {
  return hasLiteralTextFragment(sourceFile, "runtime success requires rawOutputRef")
    && hasLiteralTextFragment(sourceFile, "runtime success requires rawOutputHash")
    && hasLiteralTextFragment(sourceFile, "success proof requires rawOutputRef")
    && hasLiteralTextFragment(sourceFile, "success proof requires rawOutputHash")
    && hasLiteralTextFragment(sourceFile, "success result requires rawOutputRef")
    && hasLiteralTextFragment(sourceFile, "success result requires runtimeProof.rawOutputHash")
    && REQUIRED_SUCCESS_INVARIANT_CONDITIONS.every((fragment) => hasConditionFragment(sourceFile, fragment));
};

const findRuntimeSchemaViolations = (input: {
  runtimeSchemaSource: SourceFile;
  runtimeBoundarySchemaSource: SourceFile;
  runtimeSuccessInvariantSource: SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  if (hasCallExpression(input.runtimeBoundarySchemaSource, "passthrough")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema-runtime-output-boundary.schema.ts`, line: 1, severity: "fatal", message: "AI forbidden action output schema must not use passthrough." }));
  }
  if (!hasLiteralTextFragment(input.runtimeSchemaSource, "failed and review_required result output must be null") || !hasLiteralTextFragment(input.runtimeSchemaSource, "success result requires confidence")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema-runtime.schema.ts`, line: 1, severity: "fatal", message: "AI result schema must reject failed/review output and success without confidence." }));
  }
  if (!hasRuntimeSuccessInvariantCoverage(input.runtimeSuccessInvariantSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema-runtime.schema.ts`, line: 1, severity: "fatal", message: "AI runtime/result schemas must require raw output references and hashes for governed success paths." }));
  }
  return findings;
};

export const findOutputBoundaryViolations = (input: {
  outputBoundarySource: SourceFile;
  runtimeSchemaSource: SourceFile;
  runtimeBoundarySchemaSource: SourceFile;
  runtimeSuccessInvariantSource: SourceFile;
}): Finding[] => {
  return [
    ...findOutputBoundaryGateViolations(input.outputBoundarySource),
    ...findOutputBoundaryAliasViolations(input),
    ...findRuntimeSchemaViolations(input),
  ];
};