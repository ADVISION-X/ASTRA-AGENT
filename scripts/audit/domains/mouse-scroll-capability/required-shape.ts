import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import {
  ABILITY_GROUP_PATH,
  BROWSER_CHILD_IMPL_PATH,
  CONTRACT_PATH,
  DESKTOP_CHILD_IMPL_PATH,
  EXECUTOR_PATH,
  INDEX_PATH,
  PROOF_BUILDER_PATH,
  REGION_CHILD_IMPL_PATH,
  REGISTRY_PATH,
  RESULT_BUILDER_PATH,
  SCHEMA_PATH,
  getSourceFile,
  makeProject,
  missingRequiredFiles,
} from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingRequiredFiles();
  for (const filePath of missingFiles) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Scroll required production file is missing." }));
  }

  const project = makeProject();
  const abilityGroupSource = getSourceFile(project, ABILITY_GROUP_PATH);
  const contractSource = getSourceFile(project, CONTRACT_PATH);
  const schemaSource = getSourceFile(project, SCHEMA_PATH);
  const registrySource = getSourceFile(project, REGISTRY_PATH);
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getSourceFile(project, PROOF_BUILDER_PATH);
  const childSources = [
    getSourceFile(project, BROWSER_CHILD_IMPL_PATH),
    getSourceFile(project, DESKTOP_CHILD_IMPL_PATH),
    getSourceFile(project, REGION_CHILD_IMPL_PATH),
  ];

  if (!contractSource || !hasInterfaceMethod(contractSource, "MouseScrollAbilityGroup", "execute")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Mouse Scroll must expose a stable public execute contract." }));
  }

  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseMouseScrollAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["MouseScrollAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Mouse Scroll ability-group must parse input and parse governed output." }));
  }

  if (abilityGroupSource) {
    for (const forbidden of ["createSystemMouseScrollClock", "createMouseScrollIdempotencyRegistry"]) {
      if (hasCallExpression(abilityGroupSource, forbidden)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: `Mouse Scroll ability-group must not construct ${forbidden}.` }));
      }
    }
  }

  if (!schemaSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Scroll schema file is missing." }));
  } else {
    const requiredSchemaDecls = [
      "MouseScrollAbilityInputSchema",
      "MouseScrollAbilityResultSchema",
      "MouseScrollRuntimeProofSchema",
      "MouseScrollSuccessOutputSchema",
    ];
    for (const declarationName of requiredSchemaDecls) {
      if (!schemaSource.getVariableDeclaration(declarationName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Mouse Scroll schema must declare ${declarationName}.` }));
      }
    }

    const hasOutputNullGuard = schemaSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "failed and review_required require output=null");
    if (!hasOutputNullGuard) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Scroll result schema must force output=null for non-success states." }));
    }
  }

  if (!registrySource || !registrySource.getVariableDeclaration("CHILDREN")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Mouse Scroll registry must declare canonical children." }));
  }

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Scroll executor file is missing." }));
  } else {
    const requiredCalls = [
      "validateGeometryScrollProof",
      "validateScrollPolicy",
      "validatePreScrollSafety",
      "resolveScrollDelta",
      "runPrimitiveScroll",
      "buildMouseScrollResult",
    ];
    for (const calleeName of requiredCalls) {
      if (!hasCallExpression(executorSource, calleeName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Mouse Scroll executor must call ${calleeName}.` }));
      }
    }
  }

  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildMouseScrollRuntimeProof") || !hasCallExpressionPath(resultBuilderSource, ["MouseScrollAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll result builder must use proof builder and parse the governed result." }));
  }

  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["MouseScrollRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll proof builder must parse runtime proof output." }));
  }

  for (const childSource of childSources) {
    if (!childSource || !hasCallExpression(childSource, "executeMouseScroll")) {
      const filePath = childSource ? childSource.getFilePath() : INDEX_PATH;
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Scroll child implementation must delegate through executeMouseScroll." }));
      continue;
    }

    const hasParse = childSource.getDescendants().some((node) => {
      if (!Node.isCallExpression(node)) {
        return false;
      }

      const expression = node.getExpression();
      return Node.isPropertyAccessExpression(expression)
        && expression.getName() === "parse";
    });
    if (!hasParse) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: childSource.getFilePath(), line: 1, severity: "fatal", message: "Mouse Scroll child implementation must parse its governed child result." }));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll required package, runtime chain, and governed schema/result surfaces exist."
        : "Mouse Scroll required package or governed execution chain is incomplete.",
    ),
  };
}