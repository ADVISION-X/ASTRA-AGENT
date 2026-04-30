import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { CHILDREN, ROOT, getSource, isThinAbilityGroup, missingCanonicalFiles } from "./ast-utils.js";

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingCanonicalFiles();
  for (const file of missingFiles) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file, line: 1, severity: "fatal", message: "Required post-action-verification canonical file is missing." }));
  }

  const abilityGroupSource = getSource(project, `${ROOT}/ability-group.ts`);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: `${ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "Post Action Verification ability-group must stay a thin entrypoint." }));
  }

  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  if (contractSource.getInterface("PostActionVerificationChildCapability") || contractSource.getTypeAlias("PostActionVerificationAbilityContext")) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: `${ROOT}/contract.ts`, line: 1, severity: "fatal", message: "Post Action Verification contract must not expose child execute interface or runtime context." }));
  }

  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const childIds = getZodEnumValues(schemaSource, "PostActionVerificationChildCapabilityIdSchema");
  if (childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Schema child ids must match the frozen child registry." }));
  }

  const executorSource = getSource(project, `${ROOT}/runtime/post-action-verification-executor.ts`);
  for (const callee of [
    "validatePostActionVerificationInput",
    "validatePostActionPayloadBudget",
    "validateActionProof",
    "validateEvidenceSources",
    "validateObservationProofBinding",
    "validateBeforeAfterConsistency",
    "validateVerificationPolicy",
    "validatePostActionOutputBoundary",
    "finalizeVerificationDecision",
    "buildPostActionRuntimeProof",
    "buildPostActionVerificationResult",
  ]) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: `${ROOT}/runtime/post-action-verification-executor.ts`, line: 1, severity: "fatal", message: `Post Action Verification executor must route through ${callee}.` }));
    }
  }

  const proofBuilder = getSource(project, `${ROOT}/runtime/verification-proof-builder.ts`);
  const resultBuilder = getSource(project, `${ROOT}/runtime/verification-result-builder.ts`);
  const dispatchFailure = getSource(project, `${ROOT}/runtime/verification-dispatch-failure.ts`);
  if (!hasCallExpressionPath(proofBuilder, ["PostActionRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-proof-builder.ts`, line: 1, severity: "fatal", message: "Proof builder must parse PostActionRuntimeProofSchema." }));
  }
  if (!hasCallExpressionPath(resultBuilder, ["PostActionVerificationAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-result-builder.ts`, line: 1, severity: "fatal", message: "Result builder must parse PostActionVerificationAbilityResultSchema." }));
  }
  if (!hasCallExpressionPath(dispatchFailure, ["PostActionVerificationAbilityInputSchema", "safeParse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-dispatch-failure.ts`, line: 1, severity: "fatal", message: "Dispatch failure must terminate through the governed invalid-input envelope path." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("required-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification canonical package shape is present." : "Post Action Verification canonical package shape is incomplete."),
  };
}