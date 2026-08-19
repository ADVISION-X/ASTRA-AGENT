import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export const initializationTruthPaths = {
  readiness: "scripts/startup/lib/service-readiness.mjs",
  server: "src/app/server.ts",
  workbench: "src/lib/local-runtime/workbench.ts",
  status: "src/lib/local-runtime/workbench-status.ts",
} as const;

const getSource = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const hasStringLiteral = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === value);

const hasIdentifier = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === value);

const readinessRejectsNonHealthy = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.ExclamationEqualsEqualsToken) {
      return false;
    }
    const leftPath = astExpressionPath(expression.getLeft());
    const right = expression.getRight();
    return leftPath === "healthReport.status"
      && Node.isStringLiteral(right)
      && right.getLiteralValue() === "healthy";
  });

const closesServerOnInitializationFailure = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "close"
      && astExpressionPath(expression.getExpression()) === "server";
  });

export const inspectInitializationTruth = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const readinessSource = getSource(context, initializationTruthPaths.readiness);
  const serverSource = getSource(context, initializationTruthPaths.server);
  const workbenchSource = getSource(context, initializationTruthPaths.workbench);
  const statusSource = getSource(context, initializationTruthPaths.status);
  if (!readinessSource || !serverSource || !workbenchSource || !statusSource) {
    findings.push(createFinding({
      lawId,
      checkId: "startup/initialization-truth-sources",
      filePath: initializationTruthPaths.server,
      message: "Initialization-truth health sources must be visible to the audit project.",
    }));
    return;
  }

  const metrics = {
    readinessAcceptsOnlyHealthy: readinessRejectsNonHealthy(readinessSource),
    hasRuntimeInitializationComponent: hasStringLiteral(statusSource, "runtimeInitialization")
      && hasStringLiteral(statusSource, "ready"),
    lifecycleIsDurableInWorkbench: hasIdentifier(workbenchSource, "initializationState")
      && hasStringLiteral(workbenchSource, "failed"),
    closesServerOnInitFailure: closesServerOnInitializationFailure(serverSource),
  };
  if (Object.values(metrics).some((value) => !value)) {
    findings.push(createFinding({
      lawId,
      checkId: "startup/initialization-truth",
      filePath: initializationTruthPaths.server,
      message: "Startup must reject degraded health, expose mandatory owner initialization, and close the listener when initialization fails.",
      evidence: JSON.stringify(metrics),
    }));
  }
};
