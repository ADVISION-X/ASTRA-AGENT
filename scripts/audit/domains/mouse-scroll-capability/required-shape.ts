import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject, missingRequiredFiles, toMouseScrollRelativePath } from "./project-access.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: filePath, line: 1, severity: "fatal", message: "Mouse Scroll required production file is missing." }));
  }
}

function collectContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  if (!contractSource || !hasInterfaceMethod(contractSource, "MouseScrollAbilityGroup", "execute")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Mouse Scroll must expose a stable public execute contract." }));
  }
  const abilityGroupSource = getSourceFile(project, PATHS.ABILITY_GROUP);
  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseMouseScrollAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["MouseScrollAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Mouse Scroll ability-group must parse input and parse governed output." }));
  }
  return abilityGroupSource ? findings.concat(collectAbilityGroupFactoryFindings(abilityGroupSource)) : findings;
}

function collectAbilityGroupFactoryFindings(abilityGroupSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return ["createSystemMouseScrollClock", "createMouseScrollIdempotencyRegistry"]
    .filter((forbidden) => hasCallExpression(abilityGroupSource, forbidden))
    .map((forbidden) => createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: `Mouse Scroll ability-group must not construct ${forbidden}.` }));
}

function collectSchemaAndRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  if (!schemaSource) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Scroll schema file is missing." }));
  } else {
    for (const name of ["MouseScrollAbilityInputSchema", "MouseScrollAbilityResultSchema", "MouseScrollRuntimeProofSchema", "MouseScrollSuccessOutputSchema"]) {
      if (!schemaSource.getVariableDeclaration(name)) {
        findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Mouse Scroll schema must declare ${name}.` }));
      }
    }
    const hasOutputNullGuard = schemaSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "failed and review_required require output=null");
    if (!hasOutputNullGuard) {
      findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Scroll result schema must force output=null for non-success states." }));
    }
  }
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  return !registrySource || !registrySource.getVariableDeclaration("CHILDREN")
    ? findings.concat(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Mouse Scroll registry must declare canonical children." }))
    : findings;
}

function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  if (!executorSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Scroll executor file is missing." })];
  }

  const routeSources = [
    executorSource,
    getSourceFile(project, PATHS.EXECUTION_VALIDATOR),
    getSourceFile(project, PATHS.EXECUTION_RESERVATION),
    getSourceFile(project, PATHS.BLOCKED_RESULT_BUILDER),
    getSourceFile(project, PATHS.PRIMITIVE_RESULT_BUILDER),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);

  return ["validateGeometryScrollProof", "validateScrollPolicy", "validatePreScrollSafety", "resolveScrollDelta", "runPrimitiveScroll", "buildMouseScrollResult"]
    .filter((calleeName) => !routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName)))
    .map((calleeName) => createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Mouse Scroll executor must call ${calleeName}.` }));
}

function collectBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildMouseScrollRuntimeProof") || !hasCallExpressionPath(resultBuilderSource, ["MouseScrollAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll result builder must use proof builder and parse the governed result." }));
  }
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  return !proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["MouseScrollRuntimeProofSchema", "parse"])
    ? findings.concat(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll proof builder must parse runtime proof output." }))
    : findings;
}

function collectChildImplementationFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  for (const filePath of [PATHS.BROWSER_CHILD_IMPL, PATHS.DESKTOP_CHILD_IMPL, PATHS.REGION_CHILD_IMPL]) {
    const childSource = getSourceFile(project, filePath);
    if (!childSource || !hasCallExpression(childSource, "executeMouseScroll")) {
      findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: childSource ? toMouseScrollRelativePath(childSource) : PATHS.INDEX, line: 1, severity: "fatal", message: "Mouse Scroll child implementation must delegate through executeMouseScroll." }));
      continue;
    }
    const hasParse = childSource.getDescendants().some((node) => {
      if (!Node.isCallExpression(node)) {
        return false;
      }
      const expression = node.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "parse";
    });
    if (!hasParse) {
      findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: toMouseScrollRelativePath(childSource), line: 1, severity: "fatal", message: "Mouse Scroll child implementation must parse its governed child result." }));
    }
  }
  return findings;
}

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  const project = makeProject();
  findings.push(...collectContractFindings(project));
  findings.push(...collectSchemaAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));
  findings.push(...collectChildImplementationFindings(project));

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