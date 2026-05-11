import { readFile } from "node:fs/promises";

import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodShapePropertyNames } from "../_shared/zod-schema-fields.js";

import { PATHS } from "./config.js";

const LAW_ID = "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2";
const REQUIRED_SCHEMA_TOKENS = [
  "clickResultRef",
  "actionExecutionRef",
  "primitiveExecutionRef",
  "geometryGuardRef",
  "geometryGuardProofRef",
  "sourceCoordinateProofRef",
  "normalizedClickPoint",
  "coordinateSpace",
  "button",
  "clickCount",
  "postActionVerificationRequired",
  "postActionVerificationHandoffRef",
  "sourceVisualTargetResultRef",
] as const;
const REQUIRED_BUILDER_TOKENS = [
  "postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef",
  "actionExecutionRef: input.actionExecutionRef",
  "primitiveExecutionRef: input.primitiveExecutionRef",
  "postActionVerificationRequired: verification.postActionVerificationRequired",
] as const;
const FORBIDDEN_TOKENS = [
  "verificationDecision",
  "verificationConfidence",
  "actionResultVerifiedRef",
  "pageStateVerified",
  "finalActionLogRef",
  "fallbackUsed",
  "finalActionTruth",
  "businessTruth",
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

function collectMissingFieldFindings(input: { file: string; schemaName: string; actualFields: Set<string>; requiredFields: readonly string[]; message: string }): Finding[] {
  return input.requiredFields.flatMap((field) => {
    return input.actualFields.has(field)
      ? []
      : [createFinding({ lawId: LAW_ID, file: input.file, line: 1, severity: "fatal", message: `${input.message}: ${input.schemaName}.${field}.` })];
  });
}

export async function runJointResultContractCheck(): Promise<JointResultContractCheck> {
  const project = getAuditProject();
  const schemaSource = project.addSourceFileAtPathIfExists(pathFromRepoRoot(PATHS.SCHEMA));
  if (!schemaSource) {
    throw new Error("Missing Mouse Click schema source for joint result contract check.");
  }
  const [schemaText, resultBuilderText] = await Promise.all([
    readRepoFile(PATHS.SCHEMA),
    readRepoFile(PATHS.RESULT_BUILDER),
  ]);
  const successOutputFields = getZodShapePropertyNames(schemaSource, "MouseClickSuccessOutputSchema");
  const findings = [
    ...collectMissingFieldFindings({ file: PATHS.SCHEMA, schemaName: "MouseClickSuccessOutputSchema", actualFields: successOutputFields, requiredFields: REQUIRED_SCHEMA_TOKENS, message: "Mouse Click success output schema must expose primitive execution and PAV handoff fields" }),
    ...collectMissingTokenFindings(PATHS.SCHEMA, schemaText, REQUIRED_SCHEMA_TOKENS, "Mouse Click schema must expose the canonical post-action handoff result contract"),
    ...collectMissingTokenFindings(PATHS.RESULT_BUILDER, resultBuilderText, REQUIRED_BUILDER_TOKENS, "Mouse Click result builder must emit the canonical post-action handoff fields"),
    ...collectForbiddenTokenFindings(PATHS.SCHEMA, schemaText, FORBIDDEN_TOKENS, "Mouse Click schema must not claim verification or business truth"),
    ...collectForbiddenTokenFindings(PATHS.RESULT_BUILDER, resultBuilderText, FORBIDDEN_TOKENS, "Mouse Click result builder must not emit verification or business truth aliases"),
  ];

  return {
    findings,
    phase: createPhase(
      "joint-result-contract",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Mouse Click keeps primitive execution proof and post-action handoff truth inside MouseClickResult."
        : "Mouse Click drifted away from the canonical MouseClickResult handoff contract.",
    ),
  };
}
