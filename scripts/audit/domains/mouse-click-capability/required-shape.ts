import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import {
  ABILITY_GROUP_PATH,
  BOUNDARY_GATE_PATH,
  BROWSER_CHILD_IMPL_PATH,
  CONTRACT_PATH,
  DESKTOP_CHILD_IMPL_PATH,
  EXECUTOR_PATH,
  FAILURE_PATH,
  GEOMETRY_GATE_PATH,
  getSourceFile,
  IDEMPOTENCY_PATH,
  INDEX_PATH,
  INPUT_GATE_PATH,
  makeProject,
  missingRequiredFiles,
  POLICY_GATE_PATH,
  PRIMITIVE_PORT_PATH,
  PROOF_BUILDER_PATH,
  REGISTRY_PATH,
  RESULT_BUILDER_PATH,
  RUNNER_PATH,
  SAFETY_GATE_PATH,
  SCHEMA_PATH,
} from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingRequiredFiles();
  for (const filePath of missingFiles) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Click required production file is missing." }));
  }

  const project = makeProject();
  const abilityGroupSource = getSourceFile(project, ABILITY_GROUP_PATH);
  const contractSource = getSourceFile(project, CONTRACT_PATH);
  const schemaSource = getSourceFile(project, SCHEMA_PATH);
  const registrySource = getSourceFile(project, REGISTRY_PATH);
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getSourceFile(project, PROOF_BUILDER_PATH);
  const browserChildSource = getSourceFile(project, BROWSER_CHILD_IMPL_PATH);
  const desktopChildSource = getSourceFile(project, DESKTOP_CHILD_IMPL_PATH);

  if (!contractSource || !hasInterfaceMethod(contractSource, "MouseClickAbilityGroup", "execute")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Mouse Click must expose a stable public execute contract." }));
  }

  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseMouseClickAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["MouseClickAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Mouse Click ability-group must parse input and parse governed output." }));
  }

  if (abilityGroupSource) {
    const forbiddenRuntimeCreators = ["createSystemMouseClickClock", "createMouseClickIdempotencyRegistry"];
    for (const forbidden of forbiddenRuntimeCreators) {
      if (hasCallExpression(abilityGroupSource, forbidden)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: `Mouse Click ability-group must not construct ${forbidden}.` }));
      }
    }
  }

  if (!schemaSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Click schema file is missing." }));
  } else {
    const requiredSchemaDecls = [
      "MouseClickAbilityInputSchema",
      "MouseClickAbilityResultSchema",
      "MouseClickRuntimeProofSchema",
      "MouseClickSuccessOutputSchema",
    ];
    for (const declarationName of requiredSchemaDecls) {
      if (!schemaSource.getVariableDeclaration(declarationName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Mouse Click schema must declare ${declarationName}.` }));
      }
    }
  }

  if (!registrySource || !registrySource.getVariableDeclaration("CHILDREN")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Mouse Click registry must declare canonical children." }));
  }

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Click executor file is missing." }));
  } else {
    const requiredCalls = [
      "validateGeometryProof",
      "validateClickPolicy",
      "validateMouseClickBoundary",
      "validatePreClickSafety",
      "runPrimitiveClick",
      "buildMouseClickResult",
    ];
    for (const calleeName of requiredCalls) {
      if (!hasCallExpression(executorSource, calleeName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Mouse Click executor must call ${calleeName}.` }));
      }
    }
  }

  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildMouseClickRuntimeProof") || !hasCallExpressionPath(resultBuilderSource, ["MouseClickAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Click result builder must use proof builder and parse the governed result." }));
  }

  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["MouseClickRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Click proof builder must parse runtime proof output." }));
  }

  for (const child of [browserChildSource, desktopChildSource]) {
    if (!child || !hasCallExpression(child, "executeMouseClick")) {
      const filePath = child?.getFilePath().endsWith("implementation.ts") ? child.getFilePath() : BROWSER_CHILD_IMPL_PATH;
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Click child implementation must delegate through executeMouseClick." }));
    }
  }

  const hasOutputNullGuard = schemaSource?.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "failed and review_required require output=null") ?? false;
  if (!hasOutputNullGuard) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Click result schema must force output=null for non-success states." }));
  }

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
