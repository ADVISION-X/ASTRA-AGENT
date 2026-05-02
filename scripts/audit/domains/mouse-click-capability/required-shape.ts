import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { getSourceFile, makeProject, missingRequiredFiles } from "./audit-project.js";
import { PATHS } from "./config.js";

function collectMissingRequiredFileFindings(filePaths: string[]): Finding[] {
  return filePaths.map((filePath) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Click required production file is missing." }));
}

function collectContractFindings(contractSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !contractSource || !hasInterfaceMethod(contractSource, "MouseClickAbilityGroup", "execute")
    ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Mouse Click must expose a stable public execute contract." })]
    : [];
}

function collectAbilityGroupFindings(abilityGroupSource: ReturnType<typeof getSourceFile>): Finding[] {
  const findings: Finding[] = [];
  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseMouseClickAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["MouseClickAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Mouse Click ability-group must parse input and parse governed output." }));
  }
  if (!abilityGroupSource) {
    return findings;
  }
  for (const forbidden of ["createSystemMouseClickClock", "createMouseClickIdempotencyRegistry"]) {
    if (hasCallExpression(abilityGroupSource, forbidden)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: `Mouse Click ability-group must not construct ${forbidden}.` }));
    }
  }
  return findings;
}

function collectSchemaFindings(schemaSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!schemaSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Click schema file is missing." })];
  }

  const findings = ["MouseClickAbilityInputSchema", "MouseClickAbilityResultSchema", "MouseClickRuntimeProofSchema", "MouseClickSuccessOutputSchema"]
    .filter((declarationName) => !schemaSource.getVariableDeclaration(declarationName))
    .map((declarationName) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Mouse Click schema must declare ${declarationName}.` }));
  const hasOutputNullGuard = schemaSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "failed and review_required require output=null");
  return hasOutputNullGuard
    ? findings
    : findings.concat(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Click result schema must force output=null for non-success states." }));
}

function collectRegistryFindings(registrySource: ReturnType<typeof getSourceFile>): Finding[] {
  return !registrySource || !registrySource.getVariableDeclaration("CHILDREN")
    ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Mouse Click registry must declare canonical children." })]
    : [];
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Click executor file is missing." })];
  }
  const project = makeProject();
  const routeSources = [
    executorSource,
    getSourceFile(project, PATHS.PREFLIGHT_STAGES),
    getSourceFile(project, PATHS.PRIMITIVE_STAGE),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);
  return ["validateGeometryProof", "validateClickPolicy", "validateMouseClickBoundary", "validatePreClickSafety", "runPrimitiveClick", "buildMouseClickResult"]
    .filter((calleeName) => !routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName)))
    .map((calleeName) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Mouse Click executor must call ${calleeName}.` }));
}

function collectBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>, proofBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  const findings: Finding[] = [];
  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildMouseClickRuntimeProof") || !hasCallExpressionPath(resultBuilderSource, ["MouseClickAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder must use proof builder and parse the governed result." }));
  }
  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["MouseClickRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Mouse Click proof builder must parse runtime proof output." }));
  }
  return findings;
}

function collectChildImplementationFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [PATHS.BROWSER_CHILD_IMPL, PATHS.DESKTOP_CHILD_IMPL].flatMap((filePath) => {
    const childSource = getSourceFile(project, filePath);
    return !childSource || !hasCallExpression(childSource, "executeMouseClick")
      ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Click child implementation must delegate through executeMouseClick." })]
      : [];
  });
}

export async function runRequiredShapeAttack(project: ReturnType<typeof makeProject> = makeProject()): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = collectMissingRequiredFileFindings(await missingRequiredFiles());

  const abilityGroupSource = getSourceFile(project, PATHS.ABILITY_GROUP);
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  findings.push(...collectContractFindings(contractSource));
  findings.push(...collectAbilityGroupFindings(abilityGroupSource));
  findings.push(...collectSchemaFindings(schemaSource));
  findings.push(...collectRegistryFindings(registrySource));
  findings.push(...collectExecutorFindings(executorSource));
  findings.push(...collectBuilderFindings(resultBuilderSource, proofBuilderSource));
  findings.push(...collectChildImplementationFindings(project));

  const requiredFilesPresent = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      requiredFilesPresent ? "PASS" : "CODE VIOLATION",
      requiredFilesPresent,
      requiredFilesPresent
        ? "Mouse Click required package, runtime chain, and governed schema/result surfaces exist."
        : "Mouse Click required package or governed execution chain is incomplete.",
    ),
  };
}
