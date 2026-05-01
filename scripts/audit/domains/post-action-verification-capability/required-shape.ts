import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { isThinAbilityGroup } from "./escape-rules.js";
import { CHILDREN, LAW_IDS, PATHS } from "./config.js";
import { getSource, missingCanonicalFiles } from "./project-access.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const file of await missingCanonicalFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file, line: 1, severity: "fatal", message: "Required post-action-verification canonical file is missing." }));
  }
}

function collectAbilityAndContractFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const abilityGroupSource = getSource(project, PATHS.ABILITY_GROUP);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Post Action Verification ability-group must stay a thin entrypoint." }));
  }
  const contractSource = getSource(project, PATHS.CONTRACT);
  return contractSource.getInterface("PostActionVerificationChildCapability") || contractSource.getTypeAlias("PostActionVerificationAbilityContext")
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Post Action Verification contract must not expose child execute interface or runtime context." }))
    : findings;
}

function collectSchemaFindings(project: Project): Finding[] {
  const childIds = getZodEnumValues(getSource(project, PATHS.SCHEMA), "PostActionVerificationChildCapabilityIdSchema");
  return childIds.sort().join(",") !== [...CHILDREN].sort().join(",")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Schema child ids must match the frozen child registry." })]
    : [];
}

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSource(project, PATHS.EXECUTOR);
  for (const callee of ["runPostActionVerificationGateSequence", "completePostActionVerification"] as const) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Post Action Verification executor must route through ${callee}.` }));
    }
  }

  const routeSources = {
    validatePostActionVerificationInput: PATHS.GATE_STEPS,
    validatePostActionPayloadBudget: PATHS.GATE_STEPS,
    validateActionProof: PATHS.GATE_STEPS,
    validateEvidenceSources: PATHS.GATE_STEPS,
    validateObservationProofBinding: PATHS.GATE_STEPS,
    validateBeforeAfterConsistency: PATHS.GATE_STEPS,
    validateVerificationPolicy: PATHS.GATE_STEPS,
    validatePostActionOutputBoundary: PATHS.SUCCESS_RESULT,
    finalizeVerificationDecision: PATHS.SUCCESS_RESULT,
    buildPostActionRuntimeProof: PATHS.SUCCESS_RESULT,
    buildPostActionVerificationResult: PATHS.SUCCESS_RESULT,
  } as const;

  for (const [callee, file] of Object.entries(routeSources)) {
    if (!hasCallExpression(getSource(project, file), callee)) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file, line: 1, severity: "fatal", message: `Post Action Verification execution chain must route through ${callee}.` }));
    }
  }
  return findings;
}

function collectBuilderFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (!hasCallExpressionPath(getSource(project, PATHS.PROOF_BUILDER), ["PostActionRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Proof builder must parse PostActionRuntimeProofSchema." }));
  }
  if (!hasCallExpressionPath(getSource(project, PATHS.RESULT_BUILDER), ["PostActionVerificationAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Result builder must parse PostActionVerificationAbilityResultSchema." }));
  }
  return !hasCallExpressionPath(getSource(project, PATHS.DISPATCH_FAILURE), ["PostActionVerificationAbilityInputSchema", "safeParse"])
    ? findings.concat(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.DISPATCH_FAILURE, line: 1, severity: "fatal", message: "Dispatch failure must terminate through the governed invalid-input envelope path." }))
    : findings;
}

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectAbilityAndContractFindings(project));
  findings.push(...collectSchemaFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("required-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification canonical package shape is present." : "Post Action Verification canonical package shape is incomplete."),
  };
}