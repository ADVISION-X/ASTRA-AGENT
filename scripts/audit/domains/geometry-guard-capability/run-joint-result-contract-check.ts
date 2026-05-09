import { readFile } from "node:fs/promises";

import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodShapePropertyNames } from "../_shared/zod-schema-fields.js";

import { geometryGuardInspectionConfig as config } from "./inspection-constants.js";

const LAW_ID = "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3";
const SCHEMA_OUTPUT_PATH = `${config.ROOT}/schema-output.ts`;

const REQUIRED_RESULT_TOKENS = [
  "geometryGuardRef",
  "geometryGuardProofRef",
  "geometryGuardOutputRef",
  "geometryGuardRuntimeProofRef",
  "guardDecision",
  "output",
  "normalizedCoordinateSpace",
  "normalizedClickPoint",
  "normalizedBbox",
  "sourceVisualTargetResultRef",
] as const;
const REQUIRED_OUTPUT_TOKENS = [
  "normalizedCoordinateSpace",
  "normalizedClickPoint",
  "normalizedBbox",
] as const;
const REQUIRED_BUILDER_TOKENS = [
  "normalizedCoordinateSpace: decisionState.allowSuccess ? input.normalizedCoordinateSpace : null",
  "normalizedClickPoint: decisionState.allowSuccess ? input.normalizedClickPoint : null",
  "normalizedBbox: decisionState.allowSuccess ? input.normalizedBbox : null",
  "sourceVisualTargetResultRef: input.request.sourceVisualTargetResultRef",
] as const;
const FORBIDDEN_TOKENS = [
  "visualTargetRef:",
  "clickAllowed",
  "safeToClick",
  "postActionVerificationHandoffRef",
] as const;
const POINTER_DISPATCH_PATH = "src/lib/local-runtime/workbench-pointer-dispatch-click-command.ts";
const FORBIDDEN_POINTER_RAW_COORDINATE_TOKENS = [
  "payload.bbox",
  "payload.clickPoint",
  "payload.sourceBoundsX",
  "payload.sourceBoundsY",
  "payload.sourceBoundsWidth",
  "payload.sourceBoundsHeight",
  "payload.normalizedClickPointX",
  "payload.normalizedClickPointY",
  "payload.aiInput",
  "payload.contactSheet",
  "payload.imageEvidence",
] as const;

type JointResultContractCheck = {
  findings: Finding[];
  phase: InspectorPhase;
};

const readRepoFile = (file: string) => readFile(pathFromRepoRoot(file), "utf8");

function collectMissingTokenFindings(file: string, text: string, tokens: readonly string[], message: string): Finding[] {
  return tokens.flatMap((token) => {
    return text.includes(token)
      ? []
      : [createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message: `${message}: ${token}.` })];
  });
}

function collectForbiddenTokenFindings(file: string, text: string, tokens: readonly string[], message: string): Finding[] {
  return tokens.flatMap((token) => {
    return text.includes(token)
      ? [createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message: `${message}: ${token}.` })]
      : [];
  });
}

function collectMissingFieldFindings(file: string, schemaName: string, actualFields: Set<string>, requiredFields: readonly string[], message: string): Finding[] {
  return requiredFields.flatMap((field) => {
    return actualFields.has(field)
      ? []
      : [createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message: `${message}: ${schemaName}.${field}.` })];
  });
}

export async function runJointResultContractCheck(): Promise<JointResultContractCheck> {
  const project = getAuditProject();
  const schemaResultSource = project.addSourceFileAtPathIfExists(pathFromRepoRoot(config.SCHEMA_RESULT_PATH));
  const schemaOutputSource = project.addSourceFileAtPathIfExists(pathFromRepoRoot(SCHEMA_OUTPUT_PATH));
  if (!schemaResultSource || !schemaOutputSource) {
    throw new Error("Missing Geometry Guard schema source for joint result contract check.");
  }
  const [schemaResultText, schemaOutputText, resultBuilderText, pointerDispatchText] = await Promise.all([
    readRepoFile(config.SCHEMA_RESULT_PATH),
    readRepoFile(SCHEMA_OUTPUT_PATH),
    readRepoFile(config.RESULT_BUILDER_PATH),
    readRepoFile(POINTER_DISPATCH_PATH),
  ]);
  const resultFields = getZodShapePropertyNames(schemaResultSource, "GeometryGuardBaseResultSchema");
  const executableOutputFields = getZodShapePropertyNames(schemaOutputSource, "ExecutableGeometryOutputSchema");
  const findings = [
    ...collectMissingFieldFindings(config.SCHEMA_RESULT_PATH, "GeometryGuardBaseResultSchema", resultFields, REQUIRED_RESULT_TOKENS, "Geometry Guard result schema must expose canonical executable coordinate fields"),
    ...collectMissingFieldFindings(SCHEMA_OUTPUT_PATH, "ExecutableGeometryOutputSchema", executableOutputFields, REQUIRED_OUTPUT_TOKENS, "Geometry Guard executable output schema must expose canonical coordinate fields"),
    ...collectMissingTokenFindings(config.SCHEMA_RESULT_PATH, schemaResultText, REQUIRED_RESULT_TOKENS, "Geometry Guard result schema must expose the canonical executable coordinate contract"),
    ...collectMissingTokenFindings(SCHEMA_OUTPUT_PATH, schemaOutputText, REQUIRED_OUTPUT_TOKENS, "Geometry Guard output schema must preserve executable coordinate fields"),
    ...collectMissingTokenFindings(config.RESULT_BUILDER_PATH, resultBuilderText, REQUIRED_BUILDER_TOKENS, "Geometry Guard result builder must emit canonical executable coordinate fields only through GeometryGuardResult"),
    ...collectForbiddenTokenFindings(config.SCHEMA_RESULT_PATH, schemaResultText, FORBIDDEN_TOKENS, "Geometry Guard result schema must not leak legacy or downstream action aliases"),
    ...collectForbiddenTokenFindings(config.RESULT_BUILDER_PATH, resultBuilderText, FORBIDDEN_TOKENS, "Geometry Guard result builder must not leak legacy or downstream action aliases"),
    ...collectForbiddenTokenFindings(POINTER_DISPATCH_PATH, pointerDispatchText, FORBIDDEN_POINTER_RAW_COORDINATE_TOKENS, "Mouse Click dispatch must consume GeometryGuardResult handoff instead of raw Visual Target or AI coordinate fields"),
  ];

  return {
    findings,
    phase: createPhase(
      "joint-result-contract",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Geometry Guard keeps executable coordinate authority inside the canonical GeometryGuardResult contract."
        : "Geometry Guard drifted away from the canonical executable GeometryGuardResult contract.",
    ),
  };
}
