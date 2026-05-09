import { readFile } from "node:fs/promises";

import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodShapePropertyNames } from "../_shared/zod-schema-fields.js";

import { LAW_IDS, PATHS } from "./config.js";

const REQUIRED_RESULT_FIELDS = [
  "postActionVerificationResultRef",
  "sourceActionResultRef",
  "sourceActionRuntimeProofRef",
  "sourceActionAbilityGroupId",
  "sourceActionChildCapabilityId",
  "expectedOutcome",
  "beforeEvidenceRefs",
  "afterEvidenceRefs",
  "observationRefs",
  "supportingSourceProofRefs",
  "observationFingerprint",
  "packageStatus",
] as const;
const REQUIRED_OUTPUT_FIELDS = [
  "packageLabel",
  "observationSummary",
  "evidenceRefs",
  "observationRefs",
  "supportingSourceProofRefs",
  "postActionObservationRef",
  "actionObservationBundleRef",
  "observationFingerprint",
] as const;
const REQUIRED_SCHEMA_TOKENS = [
  ...REQUIRED_RESULT_FIELDS,
  ...REQUIRED_OUTPUT_FIELDS,
] as const;
const REQUIRED_BUILDER_TOKENS = [
  "postActionVerificationResultRef: input.outputRef",
  'packageStatus: "built"',
  "observationFingerprint",
] as const;
const FORBIDDEN_TOKENS = [
  "verificationDecision",
  "confidence:",
  "confidencePolicy",
  "actionResultVerifiedRef",
  "finalActionTruth",
  "businessTruth",
] as const;
const SUCCESS_RESULT_PATH = "src/capabilities/post-action-verification/runtime/post-action-success-result.ts";

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

function collectMissingFieldFindings(input: { file: string; schemaName: string; actualFields: Set<string>; requiredFields: readonly string[]; message: string }): Finding[] {
  return input.requiredFields.flatMap((field) => {
    return input.actualFields.has(field)
      ? []
      : [createFinding({ lawId: LAW_IDS.RESULT, file: input.file, line: 1, severity: "fatal", message: `${input.message}: ${input.schemaName}.${field}.` })];
  });
}

export async function runJointResultContractCheck(): Promise<JointResultContractCheck> {
  const project = getAuditProject();
  const schemaSource = project.addSourceFileAtPathIfExists(pathFromRepoRoot(PATHS.SCHEMA));
  if (!schemaSource) {
    throw new Error("Missing Post Action Verification schema source for joint result contract check.");
  }
  const [schemaText, resultBuilderText, successResultText] = await Promise.all([
    readRepoFile(PATHS.SCHEMA),
    readRepoFile(PATHS.RESULT_BUILDER),
    readRepoFile(SUCCESS_RESULT_PATH),
  ]);
  const resultFields = getZodShapePropertyNames(schemaSource, "PostActionVerificationAbilityResultBaseSchema");
  const outputFields = getZodShapePropertyNames(schemaSource, "PostActionVerificationOutputSchema");
  const findings = [
    ...collectMissingFieldFindings({ file: PATHS.SCHEMA, schemaName: "PostActionVerificationAbilityResultBaseSchema", actualFields: resultFields, requiredFields: REQUIRED_RESULT_FIELDS, message: "Post Action Verification result schema must expose canonical observation-package fields" }),
    ...collectMissingFieldFindings({ file: PATHS.SCHEMA, schemaName: "PostActionVerificationOutputSchema", actualFields: outputFields, requiredFields: REQUIRED_OUTPUT_FIELDS, message: "Post Action Verification output schema must expose observation bundle fields" }),
    ...collectMissingTokenFindings(PATHS.SCHEMA, schemaText, REQUIRED_SCHEMA_TOKENS, "Post Action Verification schema must expose the canonical observation-package result contract"),
    ...collectMissingTokenFindings(SUCCESS_RESULT_PATH, successResultText, REQUIRED_BUILDER_TOKENS, "Post Action Verification success result builder must emit the canonical observation-package result fields"),
    ...collectForbiddenTokenFindings(PATHS.SCHEMA, schemaText, FORBIDDEN_TOKENS, "Post Action Verification schema must not claim semantic verification truth"),
    ...collectForbiddenTokenFindings(PATHS.RESULT_BUILDER, resultBuilderText, FORBIDDEN_TOKENS, "Post Action Verification result builders must not emit semantic verification truth aliases"),
    ...collectForbiddenTokenFindings(SUCCESS_RESULT_PATH, successResultText, FORBIDDEN_TOKENS, "Post Action Verification success result builder must not emit semantic verification truth aliases"),
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
