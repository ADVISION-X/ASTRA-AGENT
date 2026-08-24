import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { isAuditTruthScanScopeFile } from "./audit-truth-scope.js";

const trackedTextRegexMethodNames = new Set(["match", "matchAll", "search", "split"]);
const trackedArgumentRegexMethodNames = new Set(["exec", "test"]);

const looksLikeRegExpType = (node: MorphNode): boolean => {
  const nodeType = node.getType();
  const candidateTypes = nodeType.isUnion() ? nodeType.getUnionTypes() : [nodeType];
  return candidateTypes.some((candidateType) => {
    const symbolName = candidateType.getSymbol()?.getName() ?? candidateType.getAliasSymbol()?.getName();
    return symbolName === "RegExp";
  });
};

const isTrackedSourceTextAccess = (node: MorphNode): boolean => {
  if (!Node.isPropertyAccessExpression(node)) {
    return false;
  }
  if (node.getName() !== "getText" && node.getName() !== "getFullText") {
    return false;
  }
  return node.getExpression().getType().getSymbol()?.getName() !== "CommentRange";
};

const findTrackedSourceTextVariableNames = (sourceFile: SourceFile): Set<string> => {
  const variableNames = new Set<string>();
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }
    const expression = initializer.getExpression();
    if (isTrackedSourceTextAccess(expression)) {
      variableNames.add(declaration.getName());
    }
  }
  return variableNames;
};

const usesTrackedSourceText = (
  node: MorphNode | undefined,
  trackedNames: ReadonlySet<string>,
): boolean => {
  if (!node) {
    return false;
  }
  if (Node.isIdentifier(node) && trackedNames.has(node.getText())) {
    return true;
  }
  if (isTrackedSourceTextAccess(node)) {
    return true;
  }
  return node.getDescendants().some((descendant) =>
    (Node.isIdentifier(descendant) && trackedNames.has(descendant.getText()))
    || isTrackedSourceTextAccess(descendant),
  );
};

const pushRegexLiteralFinding = (
  findings: InspectorFinding[],
  repoPath: string,
  lawId: string,
  evidence: string,
  message: string,
): void => {
  findings.push(
    createFinding({
      checkId: "audit-truth/source-regex-judgment",
      evidence,
      filePath: repoPath,
      lawId,
      message,
    }),
  );
};

const scanRegexMethodUsage = (
  sourceFile: SourceFile,
  repoPath: string,
  lawId: string,
  findings: InspectorFinding[],
): void => {
  const trackedNames = findTrackedSourceTextVariableNames(sourceFile);
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      continue;
    }
    const methodName = expression.getName();
    const receiver = expression.getExpression();
    const firstArgument = callExpression.getArguments()[0];
    if (
      trackedTextRegexMethodNames.has(methodName)
      && usesTrackedSourceText(receiver, trackedNames)
      && firstArgument
      && (Node.isRegularExpressionLiteral(firstArgument) || looksLikeRegExpType(firstArgument))
    ) {
      pushRegexLiteralFinding(
        findings,
        repoPath,
        lawId,
        callExpression.getText(),
        `${repoPath} calls ${methodName} with a regex-shaped argument on tracked source text inside audit enforcement scope.`,
      );
      continue;
    }
    if (
      trackedArgumentRegexMethodNames.has(methodName)
      && looksLikeRegExpType(receiver)
      && usesTrackedSourceText(firstArgument, trackedNames)
    ) {
      pushRegexLiteralFinding(
        findings,
        repoPath,
        lawId,
        callExpression.getText(),
        `${repoPath} calls RegExp.${methodName} on tracked source text inside audit enforcement scope.`,
      );
    }
  }
};

const scanAuditTruthScopeFile = (input: {
  sourceFile: SourceFile;
  inspectedFiles: Set<string>;
  lawId: string;
  findings: InspectorFinding[];
}): void => {
  const repoPath = getRepoSourcePath(input.sourceFile);
  input.inspectedFiles.add(repoPath);
  scanRegexMethodUsage(input.sourceFile, repoPath, input.lawId, input.findings);
};

export const scanAuditNoRegex = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[] } => {
  const findings: InspectorFinding[] = [];
  const scopeFiles = input.context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isAuditTruthScanScopeFile(sourceFile));

  for (const sourceFile of scopeFiles) {
    scanAuditTruthScopeFile({
      sourceFile,
      inspectedFiles: input.inspectedFiles,
      lawId: input.lawId,
      findings,
    });
  }

  return { findings };
};
