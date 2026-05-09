import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";
import { createVisualTargetAuditProject } from "./run-required-shape-attack.js";

const RESULT_BUILDER_PATH = `${config.ROOT}/runtime/visual-target-result-builder.ts`;
const REQUIRED_SCHEMA_TOKENS = [
  "notExecutableUntilGeometryGuard",
  "geometryGuardHandoffRequired",
  "geometryGuardHandoffRef",
  "geometryGuardHandoff",
] as const;
const REQUIRED_BUILDER_TOKENS = [
  "notExecutableUntilGeometryGuard: true",
  "geometryGuardHandoffRequired: true",
  "geometryGuardHandoffRef",
  "geometryGuardHandoff",
] as const;
const FORBIDDEN_RESULT_TOKENS = [
  "safeToClick",
  "canClick",
  "clickAllowed",
  "executionAllowed",
  "geometryVerified",
] as const;

type TokenCheckInput = {
  file: string;
  text: string;
  tokens: readonly string[];
  lawId: string;
  message: string;
};

function collectMissingTokenFindings(input: TokenCheckInput) {
  return input.tokens.flatMap((token) => {
    return input.text.includes(token)
      ? []
      : [createViolation({ lawId: input.lawId, file: input.file, message: `${input.message}: ${token}.` })];
  });
}

function collectForbiddenTokenFindings(input: TokenCheckInput) {
  return input.tokens.flatMap((token) => {
    return input.text.includes(token)
      ? [createViolation({ lawId: input.lawId, file: input.file, message: `${input.message}: ${token}.` })]
      : [];
  });
}

export function runJointResultContractCheck(): AttackOutcome {
  const project = createVisualTargetAuditProject();
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const resultBuilderSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
  const schemaText = schemaSource.getFullText();
  const resultBuilderText = resultBuilderSource.getFullText();
  const findings = [
    ...collectMissingTokenFindings({ file: config.SCHEMA_PATH, text: schemaText, tokens: REQUIRED_SCHEMA_TOKENS, lawId: config.ACTIVE_LAW_IDS[3], message: "Visual Target schema must expose the canonical Geometry Guard handoff contract" }),
    ...collectMissingTokenFindings({ file: RESULT_BUILDER_PATH, text: resultBuilderText, tokens: REQUIRED_BUILDER_TOKENS, lawId: config.ACTIVE_LAW_IDS[5], message: "Visual Target result builder must emit the canonical non-executable Geometry Guard handoff contract" }),
    ...collectForbiddenTokenFindings({ file: config.SCHEMA_PATH, text: schemaText, tokens: FORBIDDEN_RESULT_TOKENS, lawId: config.ACTIVE_LAW_IDS[5], message: "Visual Target result contract must not claim executable click truth" }),
    ...collectForbiddenTokenFindings({ file: RESULT_BUILDER_PATH, text: resultBuilderText, tokens: FORBIDDEN_RESULT_TOKENS, lawId: config.ACTIVE_LAW_IDS[5], message: "Visual Target result builder must not emit executable click truth aliases" }),
  ];

  return {
    findings,
    phase: createAttackPhase(
      "joint-result-contract",
      findings,
      "Visual Target keeps the canonical non-executable result contract with Geometry Guard handoff truth.",
      "Visual Target drifted away from the canonical Geometry Guard handoff result contract.",
    ),
  };
}