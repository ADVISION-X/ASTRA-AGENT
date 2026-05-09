import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { PATHS } from "./config.js";

const LAW_ID = "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2";
const REQUIRED_SCHEMA_TOKENS = [
  "clickResultRef",
  "postActionVerificationRequired",
  "postActionVerificationHandoffRef",
  "sourceVisualTargetResultRef",
] as const;
const REQUIRED_BUILDER_TOKENS = [
  "postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef",
  "actionExecutionRef: input.actionExecutionRef",
  "primitiveExecutionRef: input.primitiveExecutionRef",
  "postActionVerificationRequired: true as const",
] as const;
const FORBIDDEN_TOKENS = [
  "verificationDecision",
  "verificationConfidence",
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

export async function runJointResultContractCheck(): Promise<JointResultContractCheck> {
  const [schemaText, resultBuilderText] = await Promise.all([
    readRepoFile(PATHS.SCHEMA),
    readRepoFile(PATHS.RESULT_BUILDER),
  ]);
  const findings = [
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