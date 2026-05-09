import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";

const REQUIRED_SCHEMA_TOKENS = [
  "postActionVerificationResultRef",
  "packageLabel",
  "observationSummary",
  "evidenceRefs",
  "observationRefs",
  "supportingSourceProofRefs",
] as const;
const REQUIRED_BUILDER_TOKENS = [
  "postActionVerificationResultRef: outputRef",
  'packageStatus: "built"',
  "observationFingerprint",
] as const;
const FORBIDDEN_TOKENS = [
  "verificationDecision",
  "confidence:",
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
      : [createFinding({ lawId: LAW_IDS.RESULT, file, line: 1, severity: "fatal", message: `${message}: ${token}.` })];
  });
}

function collectForbiddenTokenFindings(file: string, text: string, tokens: readonly string[], message: string): Finding[] {
  return tokens.flatMap((token) => {
    return text.includes(token)
      ? [createFinding({ lawId: LAW_IDS.RESULT, file, line: 1, severity: "fatal", message: `${message}: ${token}.` })]
      : [];
  });
}

export async function runJointResultContractCheck(): Promise<JointResultContractCheck> {
  const [schemaText, resultBuilderText] = await Promise.all([
    readRepoFile(PATHS.SCHEMA),
    readRepoFile(PATHS.RESULT_BUILDER),
  ]);
  const findings = [
    ...collectMissingTokenFindings(PATHS.SCHEMA, schemaText, REQUIRED_SCHEMA_TOKENS, "Post Action Verification schema must expose the canonical observation-package result contract"),
    ...collectMissingTokenFindings(PATHS.RESULT_BUILDER, resultBuilderText, REQUIRED_BUILDER_TOKENS, "Post Action Verification result builders must emit the canonical observation-package result fields"),
    ...collectForbiddenTokenFindings(PATHS.SCHEMA, schemaText, FORBIDDEN_TOKENS, "Post Action Verification schema must not claim semantic verification truth"),
    ...collectForbiddenTokenFindings(PATHS.RESULT_BUILDER, resultBuilderText, FORBIDDEN_TOKENS, "Post Action Verification result builders must not emit semantic verification truth aliases"),
  ];

  return {
    findings,
    phase: createPhase(
      "joint-result-contract",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Post Action Verification keeps observation packaging truth inside PostActionVerificationResult."
        : "Post Action Verification drifted away from the canonical observation-package result contract.",
    ),
  };
}