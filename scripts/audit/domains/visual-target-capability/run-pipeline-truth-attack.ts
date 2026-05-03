import { Node, SyntaxKind, type Project } from "ts-morph";

import { flattenPropertyAccess, getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, toLine, type AttackOutcome } from "./inspection-helpers.js";

const EXPECTED_STAGE_ORDER = [
  "runPayloadBudgetStage",
  "runScreenshotStage",
  "runAiStage",
  "runPageStateStage",
  "runCandidateSourceStage",
  "runCoordinateSpaceStage",
  "runTargetTypeStage",
  "runSelectionStage",
  "runAmbiguityStage",
  "runOutputBoundaryStage",
] as const;

const OUTPUT_BOUNDARY_PATH = `${config.ROOT}/runtime/visual-target-output-boundary-gate.ts`;
const PROOF_BUILDER_PATH = `${config.ROOT}/runtime/visual-target-proof-builder.ts`;
const RESULT_BUILDER_PATH = `${config.ROOT}/runtime/visual-target-result-builder.ts`;
const STAGE_RUNNER_PATH = `${config.ROOT}/runtime/visual-target-execution-stage-runners.ts`;

const getArrayLiteralExpression = (sourceFile: import("ts-morph").SourceFile, declarationName: string) => {
  const initializer = sourceFile.getVariableDeclaration(declarationName)?.getInitializer();
  return initializer && Node.isArrayLiteralExpression(initializer) ? initializer : null;
};

const collectStageOrderFindings = (stageRunnerSource: import("ts-morph").SourceFile) => {
  const findings = [];
  const runnerArray = getArrayLiteralExpression(stageRunnerSource, "VISUAL_TARGET_STAGE_RUNNERS");
  const actualOrder = runnerArray?.getElements().flatMap((element) => Node.isIdentifier(element) ? [element.getText()] : []) ?? [];
  if (actualOrder.join(",") !== EXPECTED_STAGE_ORDER.join(",")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[4], file: STAGE_RUNNER_PATH, message: `Visual Target stage runner order must remain fixed: ${EXPECTED_STAGE_ORDER.join(" -> ")}.` }));
  }
  return findings;
};

const hasImportedName = (sourceFile: import("ts-morph").SourceFile, name: string): boolean => {
  return sourceFile.getImportDeclarations().some((declaration) => declaration.getNamedImports().some((specifier) => specifier.getName() === name));
};

const objectLiteralHasTrueProperty = (sourceFile: import("ts-morph").SourceFile, functionName: string, propertyName: string) => {
  const declaration = sourceFile.getFunction(functionName);
  if (!declaration) {
    return false;
  }
  return declaration.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    const property = objectLiteral.getProperty(propertyName);
    return property && Node.isPropertyAssignment(property) && property.getInitializer()?.getText() === "true";
  });
};

const collectChainTruthFindings = (proofSource: import("ts-morph").SourceFile, resultSource: import("ts-morph").SourceFile) => {
  const findings = [];
  if (!hasImportedName(proofSource, "resolveVisualTargetChain")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[5], file: PROOF_BUILDER_PATH, message: "Runtime proof builder must import resolveVisualTargetChain()." }));
  }
  if (!hasImportedName(resultSource, "resolveVisualTargetChain")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[5], file: RESULT_BUILDER_PATH, message: "Result builder must import resolveVisualTargetChain()." }));
  }
  if (proofSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    const [firstArgument] = callExpression.getArguments();
    return path.length === 1
      && path[0] === "buildStableVisualTargetRef"
      && firstArgument
      && Node.isStringLiteral(firstArgument)
      && firstArgument.getLiteralText() === "visual-target-run";
  })) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[5], file: PROOF_BUILDER_PATH, line: 1, message: "Runtime proof must not fabricate runId from local stable refs." }));
  }
  return findings;
};

const collectOutputBoundaryFindings = (sourceFile: import("ts-morph").SourceFile) => {
  const findings = [];
  if (!objectLiteralHasTrueProperty(sourceFile, "buildActionOutput", "notExecutableUntilGeometryGuard")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[3], file: OUTPUT_BOUNDARY_PATH, message: "Action output must keep notExecutableUntilGeometryGuard=true." }));
  }
  if (!objectLiteralHasTrueProperty(sourceFile, "buildActionOutput", "geometryGuardHandoffRequired")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[3], file: OUTPUT_BOUNDARY_PATH, message: "Action output must keep geometryGuardHandoffRequired=true." }));
  }
  const forbiddenProperty = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).find((property) => {
    const name = property.getName();
    return name === "safeToClick" || name === "clickAllowed" || name === "executionAllowed" || name === "geometryVerified";
  });
  if (forbiddenProperty) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[3], file: OUTPUT_BOUNDARY_PATH, line: toLine(forbiddenProperty), severity: "fatal", message: `Visual Target action output must not expose ${forbiddenProperty.getName()}.` }));
  }
  const criticalFlags = sourceFile.getVariableDeclaration("CRITICAL_FLAGS")?.getInitializer();
  const hasCriticalDataQuality = criticalFlags
    && Node.isNewExpression(criticalFlags)
    && criticalFlags.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "critical_data_quality");
  if (!hasCriticalDataQuality) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[4], file: OUTPUT_BOUNDARY_PATH, message: "Output boundary must fail closed on critical_data_quality." }));
  }
  return findings;
};

export async function runPipelineTruthAttack(project: Project): Promise<AttackOutcome> {
  const stageRunnerSource = getSourceFileOrThrow(project, STAGE_RUNNER_PATH);
  const proofSource = getSourceFileOrThrow(project, PROOF_BUILDER_PATH);
  const resultSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
  const outputBoundarySource = getSourceFileOrThrow(project, OUTPUT_BOUNDARY_PATH);
  const findings = [
    ...collectStageOrderFindings(stageRunnerSource),
    ...collectChainTruthFindings(proofSource, resultSource),
    ...collectOutputBoundaryFindings(outputBoundarySource),
  ];

  return { findings, phase: createAttackPhase("pipeline-truth-attack", findings, "Visual Target runtime keeps the fixed gate pipeline, real chain propagation, and non-executable Geometry Guard handoff truth.", "Visual Target runtime pipeline or chain/proof truth drifted away from the governed V2 contract.") };
}