import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { getAuditProject, getExpressionPath, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";

export const validateRunnerBoundary = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, "scripts/audit/runner.ts");
  const relativePath = toRelativeSourcePath(sourceFile);

  const importDeclarations = sourceFile.getImportDeclarations();
  const hasBuildImport = importDeclarations.some(
    (declaration) =>
      declaration.getModuleSpecifierValue() === "./build-audit-artifacts.js" &&
      declaration.getNamedImports().some((specifier) => specifier.getName() === "buildAuditArtifacts"),
  );
  if (!hasBuildImport) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: relativePath,
        line: 1,
        severity: "error",
        message: "Runner must import buildAuditArtifacts from the generator entrypoint.",
      }),
    );
  }

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const buildCall = callExpressions.find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "buildAuditArtifacts";
  });
  const loadArtifactsCall = callExpressions.find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "loadGeneratedArtifacts";
  });
  if (!buildCall || !loadArtifactsCall || buildCall.getStart() > loadArtifactsCall.getStart()) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: relativePath,
        line: getNodeLine(buildCall ?? sourceFile),
        severity: "error",
        message: "Runner must call buildAuditArtifacts before loading generated artifacts.",
      }),
    );
  }

  const planLoop = sourceFile.getDescendantsOfKind(SyntaxKind.ForOfStatement).find((statement) => {
    const expressionPath = getExpressionPath(statement.getExpression());
    return (
      expressionPath.length === 3 &&
      expressionPath[0] === "artifacts" &&
      expressionPath[1] === "auditPlan" &&
      expressionPath[2] === "owners"
    );
  });
  const planLoopCalls = planLoop?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const loadsInspectorFromPlan = planLoopCalls.some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "loadInspector") {
      return false;
    }

    const entryArgument = callExpression.getArguments()[0];
    const entryPath = getExpressionPath(entryArgument && Node.isExpression(entryArgument) ? entryArgument : undefined);
    return entryPath.length === 2 && entryPath[0] === "planOwner" && entryPath[1] === "entry";
  });
  if (!planLoop || !loadsInspectorFromPlan) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: relativePath,
        line: getNodeLine(planLoop ?? sourceFile),
        severity: "error",
        message: "Runner must execute inspectors from artifacts.auditPlan.owners rather than a manual list.",
      }),
    );
  }

  const manualOwnerList = sourceFile.getVariableDeclarations().find((declaration) => {
    if (declaration.getSourceFile() !== sourceFile) {
      return false;
    }

    const name = declaration.getName();
    if (name !== "inspectors" && name !== "owners" && name !== "lawIds") {
      return false;
    }

    return Node.isArrayLiteralExpression(declaration.getInitializer());
  });
  if (manualOwnerList) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: relativePath,
        line: getNodeLine(manualOwnerList),
        severity: "error",
        message: "Runner must not keep a manual owner or law list.",
      }),
    );
  }

  const exitAssignments = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      return false;
    }

    const leftPath = getExpressionPath(expression.getLeft());
    const right = expression.getRight();
    return (
      leftPath.length === 2 &&
      leftPath[0] === "process" &&
      leftPath[1] === "exitCode" &&
      Node.isNumericLiteral(right) &&
      right.getLiteralText() === "1"
    );
  });
  if (exitAssignments.length === 0) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: relativePath,
        line: 1,
        severity: "error",
        message: "Runner must set a failing process exit code when blocking findings are present.",
      }),
    );
  }

  phases.push(
    createPhase(
      "runner-boundary",
      findings.length === 0 ? "PASS" : "SCRIPT OVERREACH",
      findings.length === 0,
      findings.length === 0
        ? "Runner stays on the generated-plan boundary."
        : "Runner contains boundary drift or manual ownership logic.",
    ),
  );

  return { findings, phases };
};